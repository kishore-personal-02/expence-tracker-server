const mongoose = require('mongoose');

const DB_NAME = 'expense_tracker';
const INIT_COLLECTION = '_app_meta';
const INIT_DOC_ID = 'database_init';

// MongoDB only materialises a database after the first write, so existence is
// checked explicitly and, when missing, confirmed with a single metadata doc.
const databaseExists = async (db) => {
  try {
    const { databases } = await db.admin().listDatabases({ nameOnly: true });
    return databases.some((entry) => entry.name === DB_NAME);
  } catch (error) {
    // listDatabases may be denied by the cluster user; fall back to listings.
    const collections = await db.listCollections({}, { nameOnly: true }).toArray();
    return collections.length > 0;
  }
};

const initializeDatabase = async (db) => {
  // $setOnInsert keeps this idempotent: safe on every boot, never rewrites data.
  await db.collection(INIT_COLLECTION).updateOne(
    { _id: INIT_DOC_ID },
    {
      $setOnInsert: {
        description: 'Expense Tracker database initialization marker',
        createdAt: new Date(),
      },
    },
    { upsert: true }
  );
};

const connectDB = async () => {
  try {
    const uri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017';
    console.log(`Connecting to MongoDB database "${DB_NAME}"...`);

    // dbName overrides whatever path (if any) the connection string carries,
    // so credentials/host still come from .env but the database is fixed.
    const conn = await mongoose.connect(uri, { dbName: DB_NAME });
    const db = conn.connection.db;

    const exists = await databaseExists(db).catch((error) => {
      console.warn(
        `Could not verify whether "${DB_NAME}" exists (${error.message}). ` +
          'Falling back to safe initialization.'
      );
      return false;
    });

    if (exists) {
      console.log(`Database "${DB_NAME}" already exists - left unchanged.`);
    } else {
      await initializeDatabase(db);
      console.log(`Database "${DB_NAME}" did not exist - initialized.`);
    }

    console.log(`MongoDB Connected: ${conn.connection.host}/${conn.connection.name}`);
    return conn;
  } catch (error) {
    console.error(`MongoDB connection/initialization failed: ${error.message}`);
    throw error;
  }
};

module.exports = connectDB;
