/**
 * Factory function to create a middleware that fetches a document by ID.
 * 
 * @param {import('mongoose').Model} Model - The Mongoose model (e.g., User, Order, Product).
 * @param {string} paramName - The name of the parameter in the request URL (e.g., 'userId', 'orderId').
 * @param {string} reqPropertyName - The name of the property to attach the document to on the request object (e.g., 'user', 'order').
 */
const createAttachMiddleware = (Model, paramName, reqPropertyName) => {
  return async (req, res, next) => {
    const itemId = req.params[paramName]; // Get ID from params

    try {
      // Find the document using the provided Model and ID
      const item = await Model.findById(itemId).exec();

      if (!item) {
        // Not found error
        const error = new Error(`${Model.modelName} not found`);
        error.status = 404;
        return next(error);
      }

      // Attach the document to the request object
      req[reqPropertyName] = item;
      next();
    } catch (error) {
      // Database or casting error
      error.status = 500;
      next(error);
    }
  };
};

export default createAttachMiddleware;
