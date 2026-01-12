import User from '../models/User.js';
import { UserRole } from '../models/User.js';
import { paginateResponse } from '../utils/paginationHelper.js';
import {
  getManagementClient,
  getRoleId,
  getValidatedRole,
} from '../services/auth0.js';

/**
 * Create a new user
 * @param req
 * @param res
 * @param next
 * @route POST /api/users
 * @permission create:users
 * @returns {Promise<*>}
 */
export const createUser = async (req, res, next) => {
  const { username, email, name, phone, addresses = [], role: rawRole } = req.body;

  // Validate the user role
  const canSetRole = req.auth.payload.permissions?.includes('update:user-roles');
  const role = canSetRole ? getValidatedRole(rawRole) : 'customer';

  // 1. Prepare Auth0 payload
  const userData = {
    email,
    email_verified: true,
    name,
    username,
    connection: process.env.AUTH0_AUTHORIZATION_DB,
    app_metadata: {
      role,
    },
    user_metadata: {},
  };

  if (phone) {
    userData.phone_number = phone;
    userData.phone_verified = true;
  }

  try {
    // 2. Create Auth0 user
    const management = getManagementClient();
    // 2.a. Create the base Auth0 user first
    const auth0User = await management.users.create(userData);
    // 2.b. Set the Auth0 user's role
    await management.users.roles.assign(auth0User.user_id, { roles: [getRoleId(role)] });

    // 3. Create the MongoDB user in one step
    // Mongoose handles the subdocument creation for the addresses array automatically
    const newUser = new User({
      name: auth0User.name,
      email: auth0User.email,
      sub: auth0User.user_id,
      phone,
      role,
      addresses,
    });
    // Persist the new user to the database
    await newUser.save();

    // 4. Update Auth0 with local user id
    await management.users.update(auth0User.user_id, { app_metadata: { id: newUser.id } });

    return res.status(201).json(newUser);
  } catch (error) {
    return next(error);
  }
};

/**
 * Delete a user by ID
 * @param req
 * @param res
 * @param next
 * @route DELETE /api/users/:userId
 * @permission delete:users
 * @returns {Promise<*>}
 */
export const deleteUser = async (req, res, next) => {
  try {
    const { user } = req;

    // Delete the user within Auth0
    const management = getManagementClient();
    await management.users.delete(user.sub);

    // Delete the user in Mongo DB
    await user.deleteOne().exec();

    return res.status(204).end();
  } catch (error) {
    return next(error);
  }
}

/**
 * Get all users
 * @param req
 * @param res
 * @param next
 * @route GET /api/users
 * @permission read:users
 * @filter {string} [role] Filter roles (case-insensitive)
 * @filter {string} [search] Search query in name or email (case-insensitive)
 * @filter {string} [phone] Search by phone number (case-insensitive)
 * @filter {Number} [limit=100] Maximum number of users returned (100 is the maximum)
 * @filter {Number} [page=1] Page number (1 is the first page)
 * @filter {string} [sortBy=name] Sort by attribute [name, email, phone]. (e.g. sortBy=name desc)
 * @returns {Promise<void>}
 */
export const getUsers = async (req, res, next) => {
  try {
    // --- 1. Parameter Parsing and Validation ---
    const limit = parseInt(req.query.limit, 10) || 100;
    const page = parseInt(req.query.page, 10) || 1;
    const role = req.query.role?.toLowerCase() ?? undefined;
    const search = req.query.search?.toLowerCase() ?? undefined;
    const phone = req.query.phone?.toLowerCase() ?? undefined;

    // --- 2. Building the Query Object ---
    const query = {};

    // Validate and add 'role' filter if valid
    if (role && Object.keys(UserRole).includes(role)) {
      query.role = role;
    }

    // If a search query is present, add a $or query to match name or email
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
      ];
    }

    // Phone number filtering
    if (phone) {
      // TODO - OPTIMIZATION: Use exact match if possible, or a more precise regex.
      // A simple regex, common approach for finding a match:
      query.phone = { $regex: phone, $options: 'i' };
      // If you need strict international format validation, define a more specific regex pattern.
      // TODO - Pull this from an environment variable
    }

    // --- 3. Building the Sort Object ---

    // Define allowed sortable fields explicitly for security/clarity
    const allowedSortableFields = ['name', 'email', 'role'];

    // Default sort field and order
    let sortField = 'name';
    let sortOrder = 1; // 1 for ASC, -1 for DESC

    if (req.query.sortBy) {
      const fieldFromQuery = req.query.sortBy.replace(/^-/, ''); // Remove leading '-' if present
      if (allowedSortableFields.includes(fieldFromQuery)) {
        sortField = fieldFromQuery;
        // Check for descending indicator at the start
        if (req.query.sortBy.startsWith('-')) {
          sortOrder = -1;
        }
      }
    }

    const sort = { [sortField]: sortOrder };

    // --- 4. Database Operations (Concurrent Execution) ---

    // Run count and find operations concurrently for better performance
    const [usersCount, users] = await Promise.all([
      User.countDocuments(query),
      User.find(query)
        .sort(sort)
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
    ]);

    const formattedResponse = paginateResponse(req, users, usersCount, page, limit);
    return res.status(200).json(formattedResponse);
  } catch (error) {
    error.status = 500;
    return next(error);
  }
}

/**
 * Update a user by ID
 * @param req
 * @param res
 * @param next
 * @returns {Promise<void>}
 */
export const updateUser = async (req, res, next) => {
  try {
    const { user, body: updates } = req;
    const management = getManagementClient();
    const userPermissions = req.auth.payload.permissions || [];

    // 1. Separate updates into categories
    const { email, phone, role, ...otherUpdates } = updates;
    const dbUpdates = { ...updates };

    // 2. Handle Contact Updates (Must be separate calls in Auth0)
    if (email) {
      await management.users.update(user.sub, { email, email_verified: true });
    }
    if (phone) {
      await management.users.update(user.sub, { phone_number: phone, phone_verified: true });
    }

    // 3. Handle Metadata & Basic Info (Combined into one Call)
    const generalAuthData = { ...otherUpdates }

    if (role && userPermissions.includes('update:user-roles')) {
      // Manage Auth0 Roles
      const validatedRole = getValidatedRole(role);
      const roleId = getRoleId(validatedRole);
      // Fetch current Auth0 user roles
      const currentRoles = await management.users.roles.list(user.sub);
      const currentRoleIds = currentRoles.data.map(r => r.id);
      // Delete existing roles from Auth0 User
      if (currentRoleIds.length > 0) {
          await management.users.roles.delete(user.sub, { roles: currentRoleIds });
      }
      // Assign the new role to Auth0 User
      await management.users.roles.assign(user.sub, { roles: [roleId] });
      generalAuthData.app_metadata = { ...generalAuthData.app_metadata, role: validatedRole };
    } else {
      delete dbUpdates.role; // Prevent unauthorized DB update
    }

    if(Object.keys(generalAuthData).length > 0) {
      await management.users.update(user.sub, generalAuthData);
    }

    // 5. Finalize local Database Sync
    user.set(dbUpdates);
    await user.save();

    return res.status(200).json(user);
  } catch (error) {
    return next(error);
  }
}

/**
 * Update a user's password in Auth0
 * @param req
 * @param res
 * @param next
 * @returns {Promise<*>}
 */
export const updateUserPassword = async (req, res, next) => {
  try {
    const { user } = req;
    const { password } = { ...req.body };

    if (!password) {
      return res.status(400).json({ message: 'Password is required' });
    }

    const management = getManagementClient();
    await management.users.update(user.sub, { password });

    return res.status(200).json({ message: "Password updated successfully" });
  } catch (error) {
    return next(error);
  }
}

/**
 * Fetch a user by ID
 * @param req
 * @param res
 * @param next
 * @returns {Promise<*>}
 */
export const getUser = async (req, res, next) => {
  try {
    const { user } = req;
    await user.populate('orders');
    return res.status(200).json(user);
  } catch (error) {
    return next(error);
  }
}

/** User Addresses **/
/**
 * Create a new address for a user
 * @param req
 * @param res
 * @param next
 * @returns {Promise<*>}
 */
export const createAddress = async (req, res, next) => {
  try {
    const { user } = req;
    // 1. Create a new address
    const newAddress = user.addresses.create(req.body);
    // 2. Push the new address to the user's addresses array'
    user.addresses.push(newAddress);
    // 3. Save the user
    await user.save();
    return res.status(201).json(newAddress);
  } catch (error) {
    return next(error);
  }
}

/**
 * Delete a user address by ID
 * @param req
 * @param res
 * @param next
 * @returns {Promise<*>}
 */
export const deleteAddress = async (req, res, next) => {
  try {
    const { user } = req;
    user.addresses.pull({ _id: req.params.addressId });
    await user.save();
    return res.status(204).end();
  } catch (error) {
    return next(error);
  }
}

/**
 * Update a user address by ID
 * @param req
 * @param res
 * @param next
 * @returns {Promise<*>}
 */
export const updateAddress = async (req, res, next) => {
  try {
    const { user } = req;

    // 1. Locate the specified address within the user's addresses array
    const address = user.addresses.id(req.params.addressId);

    if (!address) {
      return res.status(404).json({ error: 'Address not found' });
    }

    // 2. Update the address fields using .set()
    address.set(req.body);

    // 3. SAve the user to persist the changes
    await user.save();

    return res.status(200).json(address);
  } catch (error) {
    return next(error);
  }
}
