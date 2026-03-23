import { FilterQuery } from 'mongoose';
import { matchedData } from 'express-validator';
import { StatusCodes } from "http-status-codes";
import {
  IUser,
  IUserDocument,
  AddressSubdocument, ISiteConfigurationDocument,
} from '../models/index.js';

import {
  getManagementClient,
  getRoleId,
  getValidatedRole,
  USER_ROLE_IDS,
} from '../services/auth0.js';

import { logger } from '../utils/logging/logger.js';
import { AppError } from '../utils/errors/index.js';
import { AsyncRequestHandler } from "../utils/request.js";
import { paginateResponse } from '../utils/pagination.js';
import { buildSort, parsePagination } from "../utils/controllers/queryHelper.js";
import { getTenantId } from "../utils/system.js";
import { getTenantDb, SiteConfiguration } from "../services/db.js";
import { getTenantModels } from "../types/tenantContext.js";

/**
 * Create a new user
 * @route POST /api/users
 * @permission create:users
 */
export const createUser: AsyncRequestHandler = async (req, res, next) => {
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
    connection: req.tenantConfig.backend.auth0.authorizationDB,
    app_metadata: {},
    user_metadata: {},
  };

  if (phone) {
    userData.phone_number = phone;
    userData.phone_verified = true;
  }

  try {
    const { User } = req.tenantModels;
    const tenantId = getTenantId(req);
    const management = getManagementClient(tenantId, req.tenantConfig.backend.auth0);
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
    const metadataKey = req.tenantConfig.tenantId.replace(/\./g, '_');
    await management.users.update(auth0User.user_id!, { app_metadata: { [metadataKey]: { role, id: newUser.id } } });

    res.status(StatusCodes.CREATED).json(newUser);
  } catch (error) {
    next(error);
  }
};

/**
 * Sync Auth0 user with MongoDB
 * @route POST /api/users/sync
 */
export const syncUser: AsyncRequestHandler = async (req, res, next) => {
  const { userId, tenant_id: tenantId, secret } = req.body;

  // Check for missing fields
  if (!userId || !tenantId || !secret) {
    return next(new AppError('Missing required sync parameters', StatusCodes.BAD_REQUEST));
  }

  // Verify the secret against your environment variable
  const expectedSecret = process.env.PINOY_SHOP_API_KEY;

  if (secret !== expectedSecret) {
    logger.warn({
      message: `Unauthorized sync attempt for user ${userId} with invalid secret.`,
      tenantId,
      color: logger.colors.SYSTEM_WARNING
    });
    return next(new AppError('Unauthorized', StatusCodes.UNAUTHORIZED));
  }

  // Pull the siteConfiguration for the tenant - since the request is coming from Auth0 and not the tenant
  const siteConfig = await SiteConfiguration.findOne({ tenantId }) as ISiteConfigurationDocument;
  if (!siteConfig) {
    return next(new AppError('Invalid Tenant', StatusCodes.BAD_REQUEST));
  }
  const tenantDb = await getTenantDb(siteConfig);
  const tenantModels = getTenantModels(tenantDb);
  const User = tenantModels.User;
  const role = 'customer';

  try {
    // Get Management Client
    const management = getManagementClient(tenantId, siteConfig.backend.auth0);

    // Get the Auth0User
    const auth0User = await management.users.get(userId);
    if (!auth0User.user_id) {
      return next(new AppError('Failed to find Auth0 user', StatusCodes.BAD_REQUEST));
    }

    // Check if the user exists or needs creation
    let user = await User.findOne({ sub: userId }).lean<IUserDocument>();

    if (!user) {
      // Assign the customer role as this is a self-signup user
      await management.users.roles.assign(auth0User.user_id!, { roles: [getRoleId(role)] });

      // Create and Save a MongoDB user
      const newUser = new User({
        name: auth0User.name,
        username: auth0User.username,
        email: auth0User.email,
        sub: auth0User.user_id,
        picture: auth0User.picture,
        phone: null,
        role,
        addresses: [],
      });

      await newUser.save();
      user = newUser;
    }

    // Sync MongoDB ID back to Auth0 app_meta_data - Use the Non-null assertion operator '!' since we know that user_id is defined
    const mongoId = user._id.toString();
    await management.users.update(auth0User.user_id!, { app_metadata: { [tenantId]: { role, id: mongoId } } });

    res.status(StatusCodes.OK).json({
      role: user.role,
      id: mongoId,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Delete a user by ID
 * @route DELETE /api/users/:userId
 * @permission delete:users
 */
export const deleteUser: AsyncRequestHandler = async (req, res, next) => {
  try {
    // 1. Access the user attached by the createAttachMiddleware
    const { user } = req;

    if (!user) {
      return next(new AppError('User not found', StatusCodes.NOT_FOUND));
    }

    // 2. Delete the user within Auth0
    const management = getManagementClient(getTenantId(req), req.tenantConfig.backend.auth0);

    // The '!' (non-null assertion) is used because our IUser interface guarantees that sub is defined
    await management.users.delete(user.sub!);

    // 3. Delete the user in Mongo DB
    // .deleteOne() is the modern Mongoose method for document instances
    await user.deleteOne();

    // 4. Send 204 No Content
    res.status(StatusCodes.NO_CONTENT).end();
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
 * @filter {string} [sortBy=name] Sort by attribute [name, email, phone]. (e.g., sortBy=name desc)
 */
export const getUsers: AsyncRequestHandler = async (req, res, next) => {
  try {
    const { User } = req.tenantModels;
    const { limit, page, skip } = parsePagination(req, 100);
    type queryType = { role?: string, search?: string, phone?: string, sortBy?: string };
    const { role, search, phone, sortBy } = req.query as queryType;

    // Build Query
    const query: FilterQuery<IUser> = {};

    if (role && role.toLowerCase() in USER_ROLE_IDS) {
      query.role = role.toLowerCase();
    }
    if (phone) {
      // TODO - OPTIMIZATION: Use exact match if possible, or a more precise regex.
      // A simple regex, common approach for finding a match:
      query.phone = { $regex: phone, $options: 'i' };
      // If you need strict international format validation, define a more specific regex pattern.
      // TODO - Pull this from an environment variable
    }
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { username: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
      ];
    }

    // Sort & Execute
    const sort = buildSort(sortBy, ['name', 'email', 'role']);
    const [count, users] = await Promise.all([
      User.countDocuments(query),
      User.find(query)
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .lean<IUser[]>(),
    ]);

    res.status(StatusCodes.OK).json(paginateResponse(req, users, count, page, limit));
  } catch (error) {
    next(error);
  }
}

/**
 * Update a user by ID
 * @route PUT /api/users/:userId
 */
export const updateUser: AsyncRequestHandler = async (req, res, next) => {
  try {
    const { user } = req;
    const updates = matchedData(req);

    if (!user) {
      return next(new AppError('User not found', StatusCodes.NOT_FOUND));
    }

    const management = getManagementClient(getTenantId(req), req.tenantConfig.backend.auth0);
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

    res.status(StatusCodes.OK).json(user);
  } catch (error) {
    next(error);
  }
}

/**
 * Update a user's password in Auth0
 * @route PUT /api/users/:userId/password
 */
export const updateUserPassword: AsyncRequestHandler = async (req, res, next) => {
  try {
    const { user } = req;

    if (!user) {
      return next(new AppError('User not found', StatusCodes.NOT_FOUND));
    }

    const { password } = req.body;

    if (!password) {
      return next(new AppError('Password is required', 400));
    }

    const management = getManagementClient(getTenantId(req), req.tenantConfig.backend.auth0);
    const userSub = user.sub!; // Non-null assertion for Auth0 calls
    await management.users.update(userSub, { password });

    res.status(StatusCodes.OK).json({ message: "Password updated successfully" });
  } catch (error) {
    next(error);
  }
}

/**
 * Get a specific user by ID with populated orders and Auth0 sync
 * @route GET /api/users/:userId
 */
export const getUser: AsyncRequestHandler = async (req, res, next) => {
  try {
    const { user } = req;

    if (!user) {
      return next(new AppError('User not found', StatusCodes.NOT_FOUND));
    }

    // Populate virtual 'orders'
    await user.populate('orders');

    // Sync with Auth0 for the latest profile picture
    const management = getManagementClient(getTenantId(req), req.tenantConfig.backend.auth0);

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

    res.status(StatusCodes.OK).json(userResponse);
  } catch (error) {
    next(error);
  }
}

/** User Addresses **/
/**
 * Create a new address for a user
 * @route POST /api/users/:userId/address/create
 */
export const createAddress: AsyncRequestHandler = async (req, res, next) => {
  try {
    const { user } = req;

    if (!user) {
      return next(new AppError('User not found', StatusCodes.NOT_FOUND));
    }

    // 1. Create the new address subdocument
    // .create() generates an _id and applies setters (like startCase) immediately
    const newAddress = user.addresses.create(req.body) as AddressSubdocument;


    // 2. Push the new address to the user's addresses array'
    user.addresses.push(newAddress);

    // 3. Save the parent document - Mongoose handles the validation of the new subdocument automatically
    await user.save();

    res.status(StatusCodes.CREATED).json(newAddress);
  } catch (error) {
    next(error);
  }
}

/**
 * Delete a user address by ID
 * @route DELETE /api/users/:userId/address/:addressId
 */
export const deleteAddress: AsyncRequestHandler = async (req, res, next) => {
  try {
    const { user } = req;

    if (!user) {
      return next(new AppError('User not found', StatusCodes.NOT_FOUND));
    }

    const { addressId } = req.params;

    // 1. Check if the address exists before attempting to delete
    // .id() is a helper on DocumentArrays to find a subdocument by _id
    if (!user.addresses.id(addressId)) {
      return next(new AppError('Address not found', StatusCodes.NOT_FOUND));
    }

    // 2. Remove the address from the user's addresses array
    // .pull() is the atomic way to remove a subdocument in Mongoose
    user.addresses.pull({ _id: addressId });

    // 3. Save the parent document
    // Our pre-validate hook in User.ts will automatically handle resetting the primaryAddressId if the deleted address was the primary one.
    await user.save();

    res.status(StatusCodes.NO_CONTENT).end();
  } catch (error) {
    next(error);
  }
}

/**
 * Update a user address by ID
 * @route PUT /api/users/:userId/address/:addressId
 */
export const updateAddress: AsyncRequestHandler = async (req, res, next) => {
  try {
    const { user } = req;

    if (!user) {
      return next(new AppError('User not found', StatusCodes.NOT_FOUND));
    }

    const { addressId } = req.params;
    const updates = matchedData(req);

    // 1. Locate the specific subdocument
    // We type this as AddressSubdocument to enable .set() and other Mongoose methods
    const address = user.addresses.id(addressId) as AddressSubdocument | null;

    if (!address) {
      return next(new AppError('Address not found', StatusCodes.NOT_FOUND));
    }

    // 2. Update the address fields
    // .set() on a subdocument performs a path-based update
    address.set(updates);

    // 3. Save the parent User document
    // This triggers the pre-validate hook in User.ts, ensuring the primaryAddressId logic is updated if _isPrimaryInput was set.
    await user.save();

    res.status(StatusCodes.OK).json(address);
  } catch (error) {
    next(error);
  }
}
