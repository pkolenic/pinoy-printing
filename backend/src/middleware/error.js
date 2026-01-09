const errorHandler = (err, req, res, next) => {
    console.error('Error creating user:', err);
    if (err.status) {
        res.status(err.status).json({message: err.message});
    } else {
        res.status(500).json({message: err.message});
    }
};

export default errorHandler;
