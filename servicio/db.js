const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const config = {
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  port: parseInt(process.env.DB_PORT) || 5432,
  max: 30,
  idleTimeoutMillis: 600000
};

// Dummy sql object to prevent errors when routes reference sql.Int, etc.
const sql = {
  Int: 'Int',
  VarChar: 'VarChar',
  NVarChar: 'NVarChar',
  Text: 'Text',
  DateTime: 'DateTime',
  Bit: 'Bit',
  BigInt: 'BigInt',
  Decimal: 'Decimal',
  Float: 'Float',
  Money: 'Money',
  SmallInt: 'SmallInt',
  TinyInt: 'TinyInt',
  Date: 'Date',
  Time: 'Time',
  Numeric: 'Numeric',
  SmallDateTime: 'SmallDateTime',
  Real: 'Real',
  UniqueIdentifier: 'UniqueIdentifier'
};

const connectWithRetry = async (retries = 5, delay = 5000) => {
  for (let i = 0; i < retries; i++) {
    try {
      const pgPool = new Pool(config);
      // Test connection
      const client = await pgPool.connect();
      console.log('✅ Connected to PostgreSQL');
      client.release();
      
      // Shim to make pgPool behave like mssql connection pool
      const mssqlPoolShim = {
        connected: true,
        connect: async () => { return mssqlPoolShim; },
        request: () => {
          const inputs = {};
          
          return {
            input: function(name, type, value) {
              if (arguments.length === 2) {
                inputs[name] = type;
              } else {
                inputs[name] = value;
              }
              return this;
            },
            query: async function(queryString) {
              let pgQueryString = queryString;
              const values = [];
              let paramIndex = 1;
              
              // Sort keys by length descending to prevent partial replacements (e.g. @param1 replacing @param10)
              const keys = Object.keys(inputs).sort((a, b) => b.length - a.length);
              
              for (const key of keys) {
                const regex = new RegExp(`@${key}\\b`, 'g');
                if (regex.test(pgQueryString)) {
                  pgQueryString = pgQueryString.replace(regex, `$${paramIndex}`);
                  values.push(inputs[key]);
                  paramIndex++;
                }
              }
              
              try {
                const result = await pgPool.query(pgQueryString, values);
                // mssql usually returns { recordset: [...rows], rowsAffected: [...] }
                return {
                  recordset: result.rows,
                  rowsAffected: [result.rowCount]
                };
              } catch (err) {
                console.error('Error executing query:', err);
                throw err;
              }
            }
          };
        }
      };
      
      return mssqlPoolShim;
    } catch (err) {
      console.error(`❌ Database Connection Failed (Attempt ${i + 1}/${retries}):`, err.message);
      if (i === retries - 1) throw err;
      console.log(`⏳ Retrying in ${delay / 1000} seconds...`);
      await new Promise(res => setTimeout(res, delay));
    }
  }
};

const poolPromise = connectWithRetry()
  .catch(err => {
    console.error('❌ Final Database Connection Error:', err);
    throw err;
  });

module.exports = {
  sql,
  poolPromise
};
