import mongoose from 'mongoose';

export const connectDB = async () => {
    try {
        await mongoose.connect(
            process.env.MONGO_URI,
    {
                dbName: process.env.MONGO_DB,
            },
        );
        console.log('MongoDB connected');
    } catch (err) {
        console.error('MongoDB connection error:', err);
        process.exit(1); // Exit process with a failure
    }
}

export const disconnectDB = async () => {
    try {
        await mongoose.disconnect();
        console.log('MongoDB disconnected');
    } catch (err) {
        console.error('MongoDB disconnection error:', err);
    }
}
