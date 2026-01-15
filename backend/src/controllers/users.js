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

    // 3. Handle Primary Address Logic
    const primaryIndex = addresses.findIndex(addr => addr.isPrimary === true);

    // 4. Create the MongoDB user
    // Mongoose handles the subdocument creation for the addresses array automatically
    const newUser = new User({
      name: auth0User.name,
      email: auth0User.email,
      sub: auth0User.user_id,
      phone,
      role,
      addresses,
    });

    // Link the primaryAddressId to the generated ID of the selected address
    if (primaryIndex !== -1) {
      newUser.primaryAddressId = newUser.addresses[primaryIndex]._id;
    } else if (newUser.addresses.length > 0) {
      // Optional: Default to the first address if none marked primary
      newUser.primaryAddressId = newUser.addresses[0]._id;
    }

    // Persist the new user to the database
    await newUser.save();

    // 5. Update Auth0 with local user id
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
    const { email, phone, role, addresses, orders, ...otherUpdates } = updates;
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

    // 4. Local Database Sync & Primary Address Logic
    // Step A: Find the index of the address marked as primary in the request payload
    const primaryIndex = updates.addresses?.findIndex(addr => addr.isPrimary === true);

    // Step B: Synchronize the local 'user' document with the updates.
    // This updates the addresses array in memory and generates _ids for new items instantly.
    user.set(dbUpdates);

    // Step C: Update the primaryAddressId reference based on the found index
    if (primaryIndex !== undefined && primaryIndex !== -1) {
      // Use the newly generated or existing _id from the memory-updated array
      user.primaryAddressId = user.addresses[primaryIndex]._id;
    } else if (updates.addresses && updates.addresses.length === 0) {
      // Clear the primary pointer if the user deleted all addresses
      user.primaryAddressId = undefined;
    }

    // 5. Save the final state to MongoDB
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
    const addressData = req.body;

    // 1. Create the new address subdocument
    const newAddress = user.addresses.create(addressData);

    // 2. Push the new address to the user's addresses array'
    user.addresses.push(newAddress);

    // 3. Handle Primary Address Logic
    // If the flag is present, or if this is the user's first address
    if (addressData.isPrimary || user.addresses.length === 1) {
      user.primaryAddressId = newAddress._id;
    }

    // 4. Save the user
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
    const addressIdToDelete = req.params.addressId;

    // 1. Remove the address from the user's addresses array
    user.addresses.pull({ _id: addressIdToDelete });

    // 2. Check if the deleted address was the primary one
    // Note: Use .equals() for comparing Mongoose ObjectIds safely
    if (user.primaryAddressId && user.primaryAddressId.equals(addressIdToDelete)) {
      // Option A: Set to the next available address (Auto-reassign)
      if (user.addresses.length > 0) {
        user.primaryAddressId = user.addresses[0]?._id;
      } else {
        user.primaryAddressId = undefined;
      }
    }

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
    const { addressId } = req.params;
    const updates = req.body;

    // 1. Locate the specified address within the user's addresses array
    const address = user.addresses.id(addressId);

    if (!address) {
      return res.status(404).json({ error: 'Address not found' });
    }

    // 2. Update the address fields using .set()
    address.set(updates);

    // 3. Handle Primary Address Logic
    if (updates.isPrimary === true) {
      user.primaryAddressId = address._id;
    }

    // 4. Save the user to persist the changes
    await user.save();

    return res.status(200).json(address);
  } catch (error) {
    return next(error);
  }
}
