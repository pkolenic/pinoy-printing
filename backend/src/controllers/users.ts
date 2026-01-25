import { RequestHandler } from "express";
import { FilterQuery, SortOrder } from 'mongoose';

import {
  User,
  UserRole,
  IUser,
  IUserDocument,
  AddressSubdocument,
} from '../models/index.js';

import {
  getManagementClient,
  getRoleId,
  getValidatedRole,
} from '../services/auth0.js';

import { AppError } from '../utils/errors/index.js';
import { paginateResponse } from '../utils/paginationHelper.js';

/**
 * Create a new user
 * @route POST /api/users
 * @permission create:users
 */
export const createUser: RequestHandler = async (req, res, next) => {
  const { username, email, name, phone, addresses = [], role: rawRole } = req.body;

  // 1. Validate the user role with a type-safe permission check
  const canSetRole: boolean = req.auth?.payload.permissions?.includes('update:user-roles') ?? false;
  const role = canSetRole ? getValidatedRole(rawRole) : 'customer';

  // 2. Prepare Auth0 payload
  // Note: 'any' is used for userData because Auth0 SDK types can be overly restrictive with metadata
  const userData: any = {
    email,
    email_verified: true,
    name,
    username,
    connection: process.env.AUTH0_AUTHORIZATION_DB,
    app_metadata: { role },
    user_metadata: {},
  };

  if (phone) {
    userData.phone_number = phone;
    userData.phone_verified = true;
  }

  try {
    const management = getManagementClient();
    // 3. Create an Auth0 user
    const auth0User = await management.users.create(userData);

    if (!auth0User.user_id) {
      return next(new AppError('Failed to create Auth0 user', 500));
    }

    // 4. Assign Auth0 Role - Use the Non-null assertion operator '!' since we know that user_id is defined
    await management.users.roles.assign(auth0User.user_id!, { roles: [getRoleId(role)] });

    // 5. Create and Save MongoDB user
    // We explicitly type newUser as a Document of IUser
    const newUser = new User({
      name: auth0User.name,
      username: auth0User.username,
      email: auth0User.email,
      sub: auth0User.user_id,
      picture: auth0User.picture,
      phone,
      role,
      addresses,
    }) as IUserDocument;

    await newUser.save();

    // 6. Sync MongoDB ID back to Auth0 app_meta_data - Use the Non-null assertion operator '!' since we know that user_id is defined
    await management.users.update(auth0User.user_id!, { app_metadata: { id: newUser.id } });

    res.status(201).json(newUser);
  } catch (error) {
    next(error);
  }
};

/**
 * Delete a user by ID
 * @route DELETE /api/users/:userId
 * @permission delete:users
 */
export const deleteUser: RequestHandler = async (req, res, next) => {
  try {
    // 1. Access the user attached by the createAttachMiddleware
    const { user } = req;

    if (!user) {
      return next(new AppError('User not found', 404));
    }

    // 2. Delete the user within Auth0
    const management = getManagementClient();

    // The '!' (non-null assertion) is used because our IUser interface guarantees that sub is defined
    await management.users.delete(user.sub!);

    // 3. Delete the user in Mongo DB
    // .deleteOne() is the modern Mongoose method for document instances
    await user.deleteOne();

    // 4. Send 204 No Content
    res.status(204).end();
  } catch (error) {
    next(error);
  }
}

/**
 * Get all users
 * @route GET /api/users
 * @permission read:users
 * @filter {string} [role] Filter roles (case-insensitive)
 * @filter {string} [search] Search query in name or email (case-insensitive)
 * @filter {string} [phone] Search by phone number (case-insensitive)
 * @filter {Number} [limit=100] Maximum number of users returned (100 is the maximum)
 * @filter {Number} [page=1] Page number (1 is the first page)
 * @filter {string} [sortBy=name] Sort by attribute [name, email, phone]. (e.g. sortBy=name desc)
 */
export const getUsers: RequestHandler = async (req, res, next) => {
  try {
    // 1. Parameter Parsing with Explicate Casting
    // req.query values are strings or arrays; we cast to string for parsing
    const limit = parseInt(req.query.limit as string, 10) || 100;
    const page = parseInt(req.query.page as string, 10) || 1;
    const role = (req.query.role as string)?.toLowerCase();
    const search = (req.query.search as string)?.toLowerCase();
    const phone = (req.query.phone as string)?.toLowerCase();
    const sortBy = (req.query.sortBy as string)?.toLowerCase();

    // 2. Building the Query Object
    // Use FilterQuery<IUser> to allow Mongoose-specific keys ($or, etc.)
    const query: FilterQuery<IUser> = {};

    // Validate and add 'role' filter if valid
    if (role && Object.keys(UserRole).includes(role)) {
      query.role = role;
    }

    // If a search query is present, add an $or query to match the name or email
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { username: { $regex: search, $options: 'i' } },
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

    // 3. Building the Sort Object
    // Define allowed sortable fields explicitly for security/clarity
    const allowedSortableFields = ['name', 'email', 'role'];

    // Default sort field and order
    let sortField = 'name';
    let sortOrder: SortOrder = 'asc';

    if (sortBy) {
      const fieldFromQuery = sortBy.replace(/^-/, ''); // Remove leading '-' if present
      if (allowedSortableFields.includes(fieldFromQuery)) {
        sortField = fieldFromQuery;
        // Check for the descending indicator at the start
        if (sortBy.startsWith('-')) {
          sortOrder = 'desc';
        }
      }
    }

    // Construct sort object with bracket notation
    const sort: { [key: string]: SortOrder } = { [sortField]: sortOrder };

    // 4. Database Operations (Concurrent Execution)
    // Run count and find operations concurrently for better performance
    const [usersCount, users] = await Promise.all([
      User.countDocuments(query),
      User.find(query)
        .sort(sort)
        .skip((page - 1) * limit)
        .limit(limit)
        .lean<IUser[]>(), // lean() returns plain JS objects (IUser[])
    ]);

    // 5. Response Formatting
    const formattedResponse = paginateResponse<IUser>(req, users, usersCount, page, limit);

    res.status(200).json(formattedResponse);
  } catch (error) {
    next(error);
  }
}

/**
 * Update a user by ID
 * @route PUT /api/users/:userId
 */
export const updateUser: RequestHandler = async (req, res, next) => {
  try {
    const { user, body: updates } = req;

    if (!user) {
      return next(new AppError('User not found', 404));
    }

    const management = getManagementClient();
    const canSetRole: boolean = req.auth?.payload.permissions?.includes('update:user-roles') ?? false;
    const userSub = user.sub!; // Non-null assertion for Auth0 calls

    // 1. Separate updates into categories
    const { email, phone, role, addresses, orders, ...otherUpdates } = updates;
    const dbUpdates: Partial<IUser> = { ...updates };

    // 2. Handle Contact Updates (Auth0 v4 requires separate calls or specific metadata)
    if (email) {
      await management.users.update(userSub, { email, email_verified: true });
    }
    if (phone) {
      await management.users.update(userSub, { phone_number: phone, phone_verified: true });
    }

    // 3. Handle Metadata & Basic Info (Combined into one Call)
    const generalAuthData: any = { ...otherUpdates }

    if (role && canSetRole) {
      const validatedRole = getValidatedRole(role);
      const roleId = getRoleId(validatedRole);

      // Auth0 v4 SDK: Pass user_id as a direct string for list and assign
      const { data: currentRoles } = await management.users.roles.list(userSub);
      const currentRoleIds = currentRoles.map((r: any) => r.id);

      // Remove existing roles before assigning the new one
      if (currentRoleIds.length > 0) {
        await management.users.roles.delete(userSub, { roles: currentRoleIds });
      }

      // Assign the new role to Auth0 User
      await management.users.roles.assign(userSub, { roles: [roleId] });

      // Sync metadata for Auth0
      generalAuthData.app_metadata = { ...generalAuthData.app_metadata, role: validatedRole };

      // Ensure DB updates includes the new role
      dbUpdates.role = validatedRole
    } else {
      // If a user tried to set a role but lacked permission, remove it from the update object
      delete dbUpdates.role;
    }

    // Update general info in Auth0 if any exists
    if (Object.keys(generalAuthData).length > 0) {
      await management.users.update(userSub, generalAuthData);
    }

    // 4. Sync Auth0 picture back to MongoDB
    const auth0User = await management.users.get(userSub);
    dbUpdates.picture = auth0User.picture;

    // 5. Local Database Sync & Save
    // .set() performs a deep merge on Mongoose document instances
    user.set(dbUpdates);
    await user.save();

    res.status(200).json(user);
  } catch (error) {
    next(error);
  }
}

/**
 * Update a user's password in Auth0
 * @route PUT /api/users/:userId/password
 */
export const updateUserPassword: RequestHandler = async (req, res, next) => {
  try {
    const { user } = req;

    if (!user) {
      return next(new AppError('User not found', 404));
    }

    const { password } = req.body;

    if (!password) {
      return next(new AppError('Password is required', 400));
    }

    const management = getManagementClient();
    const userSub = user.sub!; // Non-null assertion for Auth0 calls
    await management.users.update(userSub, { password });

    res.status(200).json({ message: "Password updated successfully" });
  } catch (error) {
    next(error);
  }
}

/**
 * Get a specific user by ID with populated orders and Auth0 sync
 * @route GET /api/users/:userId
 */
export const getUser: RequestHandler = async (req, res, next) => {
  try {
    const { user } = req;

    if (!user) return next(new AppError('User not found', 404));

    // Populate virtual 'orders'
    await user.populate('orders');

    // Sync with Auth0 for the latest profile picture
    const management = getManagementClient();

    // The '!' (non-null assertion) is used because our IUser interface guarantees that sub is defined
    const auth0User = await management.users.get(user.sub!);

    /**
     * Merge and Respond
     * We use user.toObject() to get a plain JS object, then override the picture with the real-time data from Auth0.
     */
    const userResponse = {
      ...user.toObject(),
      picture: auth0User.picture,
    }

    res.status(200).json(userResponse);
  } catch (error) {
    next(error);
  }
}

/** User Addresses **/
/**
 * Create a new address for a user
 * @route POST /api/users/:userId/address/create
 */
export const createAddress: RequestHandler = async (req, res, next) => {
  try {
    const { user } = req;

    if (!user) {
      return next(new AppError('User not found', 404));
    }

    // 1. Create the new address subdocument
    // .create() generates an _id and applies setters (like startCase) immediately
    const newAddress = user.addresses.create(req.body) as AddressSubdocument;


    // 2. Push the new address to the user's addresses array'
    user.addresses.push(newAddress);

     // 3. Save the parent document - Mongoose handles the validation of the new subdocument automatically
    await user.save();

    res.status(201).json(newAddress);
  } catch (error) {
    next(error);
  }
}

/**
 * Delete a user address by ID
 * @route DELETE /api/users/:userId/address/:addressId
 */
export const deleteAddress: RequestHandler = async (req, res, next) => {
  try {
    const { user } = req;

    if (!user) {
      return next(new AppError('User not found', 404));
    }

    const { addressId } = req.params;

    // 1. Check if the address exists before attempting to delete
    // .id() is a helper on DocumentArrays to find a subdocument by _id
    if (!user.addresses.id(addressId)) {
      return next(new AppError('Address not found', 404));
    }

    // 2. Remove the address from the user's addresses array
    // .pull() is the atomic way to remove a subdocument in Mongoose
    user.addresses.pull({ _id: addressId });

    // 3. Save the parent document
    // Our pre-validate hook in User.ts will automatically handle resetting the primaryAddressId if the deleted address was the primary one.
    await user.save();

    res.status(204).end();
  } catch (error) {
    next(error);
  }
}

/**
 * Update a user address by ID
 * @route PUT /api/users/:userId/address/:addressId
 */
export const updateAddress: RequestHandler = async (req, res, next) => {
  try {
    const { user } = req;

    if (!user) {
      return next(new AppError('User not found', 404));
    }

    const { addressId } = req.params;
    const updates = req.body;

    // 1. Locate the specific subdocument
    // We type this as AddressSubdocument to enable .set() and other Mongoose methods
    const address = user.addresses.id(addressId) as AddressSubdocument | null;

    if (!address) {
      return next(new AppError('Address not found', 404));
    }

    // 2. Update the address fields
    // .set() on a subdocument performs a path-based update
    address.set(updates);

     // 3. Save the parent User document
     // This triggers the pre-validate hook in User.ts, ensuring the primaryAddressId logic is updated if _isPrimaryInput was set.
    await user.save();

    res.status(200).json(address);
  } catch (error) {
    next(error);
  }
}
