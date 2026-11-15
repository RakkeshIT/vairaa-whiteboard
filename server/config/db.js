import mongoose from "mongoose";

let connection;

// Memoized so the auth config and the server entry share a single connection
export const connectDB = () => {
  connection ??= (async () => {
    try {
      const conn = await mongoose.connect(process.env.MONGODB_URI, {
        serverSelectionTimeoutMS: 10000,
        socketTimeoutMS: 45000,
      });

      console.log(`[MongoDB] Connected successfully to Atlas Cluster: ${conn.connection.host}`);
      console.log(`[MongoDB] Active Database: ${conn.connection.name}`);
      return conn.connection;
    } catch (error) {
      console.error(`[MongoDB Error] Connection failed: ${error.message}`);
      process.exit(1);
    }
  })();
  return connection;
};
