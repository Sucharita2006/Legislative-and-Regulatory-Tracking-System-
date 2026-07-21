import fs from 'fs';
import path from 'path';
import pg from 'pg';
import dns from 'dns';

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const schemaPath = path.join(process.cwd(), 'supabase', 'schema.sql');
const sql = fs.readFileSync(schemaPath, 'utf8');

async function run() {
  const dnsName = 'db.wxqnvbyeafrtozchnwvn.supabase.co';
  const user = 'postgres';
  const password = 'aldftrackingagent';
  const dbName = 'postgres';
  const port = 5432;
  
  console.log(`Resolving IPv6 address for ${dnsName}...`);
  let host;
  try {
    const ips = await dns.promises.resolve6(dnsName);
    host = ips[0];
    console.log(`Resolved to IPv6 address: ${host}`);
  } catch (err) {
    console.error("Failed to resolve IPv6 address:", err);
    process.exit(1);
  }

  // pg connection options using IP address
  const client = new pg.Client({
    host: host,
    port: port,
    user: user,
    password: password,
    database: dbName,
    ssl: { rejectUnauthorized: false }
  });
  
  console.log(`Connecting directly to IPv6 address [${host}]:${port}...`);
  try {
    await client.connect();
    console.log("Connected successfully to the Supabase database!");
    console.log("Executing schema.sql...");
    await client.query(sql);
    console.log("SQL Schema executed successfully!");
  } catch (error) {
    console.error("Error executing schema:", error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

run();
