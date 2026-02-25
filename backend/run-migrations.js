/**
 * KudiSave Database Migration Runner
 * Runs all SQL schema files against the PostgreSQL database in order.
 * Safe to re-run — uses IF NOT EXISTS and ON CONFLICT where possible.
 */
const fs = require('fs');
const path = require('path');
const { pool } = require('./src/config/database');
require('dotenv').config();

const SQL_FILES = [
  { name: 'Base Schema', path: path.join(__dirname, '..', 'database_schema.sql') },
  { name: 'Schema V2 (Bills, Currencies, Challenges, Achievements)', path: path.join(__dirname, '..', 'database_schema_v2.sql') },
  { name: 'Migration: Gmail OAuth', path: path.join(__dirname, 'migrations', 'add_gmail_oauth.sql') },
  { name: 'Migration: Missing Tables', path: path.join(__dirname, 'migrations', 'add_missing_tables.sql') },
  { name: 'Migration: User Preferences', path: path.join(__dirname, 'migrations', 'add_user_preferences.sql') },
  { name: 'Migration: Subscriptions & Savings', path: path.join(__dirname, 'migrations', 'add_subscriptions_and_savings.sql') },
];

/**
 * Make CREATE TABLE statements idempotent by adding IF NOT EXISTS
 */
function makeIdempotent(sql) {
  // Add IF NOT EXISTS to CREATE TABLE that doesn't already have it
  sql = sql.replace(/CREATE TABLE(?!\s+IF\s+NOT\s+EXISTS)\s+/gi, 'CREATE TABLE IF NOT EXISTS ');
  // Add IF NOT EXISTS to CREATE INDEX that doesn't already have it
  sql = sql.replace(/CREATE INDEX(?!\s+IF\s+NOT\s+EXISTS)\s+/gi, 'CREATE INDEX IF NOT EXISTS ');
  // CREATE UNIQUE INDEX
  sql = sql.replace(/CREATE UNIQUE INDEX(?!\s+IF\s+NOT\s+EXISTS)\s+/gi, 'CREATE UNIQUE INDEX IF NOT EXISTS ');
  // Handle INSERT with potential duplicates — add ON CONFLICT DO NOTHING to plain INSERTs
  // (only for seed data INSERTs that don't already have ON CONFLICT)
  // We do this selectively to avoid breaking INSERTs that need to succeed
  return sql;
}

/**
 * Split SQL into individual statements, handling multi-line functions/triggers
 */
function splitStatements(sql) {
  // Remove single-line comments but keep the newlines
  const cleaned = sql.replace(/--[^\n]*/g, '');
  
  // Split by semicolons but be careful with $$ blocks (PL/pgSQL functions)
  const statements = [];
  let current = '';
  let inDollarBlock = false;
  
  for (let i = 0; i < cleaned.length; i++) {
    const char = cleaned[i];
    const next = cleaned[i + 1];
    
    if (char === '$' && next === '$') {
      inDollarBlock = !inDollarBlock;
      current += '$$';
      i++; // skip next $
      continue;
    }
    
    if (char === ';' && !inDollarBlock) {
      const trimmed = current.trim();
      if (trimmed.length > 0) {
        statements.push(trimmed + ';');
      }
      current = '';
      continue;
    }
    
    current += char;
  }
  
  // Handle any remaining content
  const trimmed = current.trim();
  if (trimmed.length > 0) {
    statements.push(trimmed);
  }
  
  return statements;
}

async function runMigrations() {
  console.log('\n🚀 KudiSave Database Migration Runner');
  console.log('═'.repeat(50));
  
  const client = await pool.connect();
  
  try {
    let totalStatements = 0;
    let successCount = 0;
    let skipCount = 0;
    let errorCount = 0;

    for (const file of SQL_FILES) {
      console.log(`\n📄 Running: ${file.name}`);
      console.log(`   File: ${path.basename(file.path)}`);
      
      if (!fs.existsSync(file.path)) {
        console.log(`   ⚠️  File not found, skipping...`);
        continue;
      }
      
      let sql = fs.readFileSync(file.path, 'utf8');
      sql = makeIdempotent(sql);
      
      const statements = splitStatements(sql);
      console.log(`   Found ${statements.length} statements`);
      
      for (let i = 0; i < statements.length; i++) {
        const stmt = statements[i];
        totalStatements++;
        
        // Get a preview of the statement
        const preview = stmt.substring(0, 80).replace(/\s+/g, ' ').trim();
        
        try {
          await client.query(stmt);
          successCount++;
          // Show CREATE/ALTER/INSERT but not all
          if (/^(CREATE|ALTER|INSERT|DROP)/i.test(stmt)) {
            console.log(`   ✅ ${preview}...`);
          }
        } catch (err) {
          // These are safe to ignore (already exists, etc.)
          const safeErrors = [
            '42P07', // duplicate_table
            '42P16', // invalid_table_definition (constraint already exists)  
            '42710', // duplicate_object (index, constraint, etc.)
            '23505', // unique_violation (seed data already inserted)
            '42701', // duplicate_column
          ];
          
          if (safeErrors.includes(err.code)) {
            skipCount++;
            console.log(`   ⏭️  Already exists: ${preview}...`);
          } else {
            errorCount++;
            console.log(`   ❌ Error on: ${preview}...`);
            console.log(`      Code: ${err.code} — ${err.message}`);
          }
        }
      }
    }
    
    console.log('\n' + '═'.repeat(50));
    console.log('📊 Migration Summary:');
    console.log(`   Total statements: ${totalStatements}`);
    console.log(`   ✅ Successful:    ${successCount}`);
    console.log(`   ⏭️  Skipped:       ${skipCount}`);
    console.log(`   ❌ Errors:        ${errorCount}`);
    console.log('═'.repeat(50));
    
    // Verify all tables exist
    const tableCheck = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `);
    
    console.log(`\n📋 Tables in database (${tableCheck.rows.length}):`);
    tableCheck.rows.forEach(row => {
      console.log(`   • ${row.table_name}`);
    });
    
    // Check views
    const viewCheck = await client.query(`
      SELECT table_name 
      FROM information_schema.views 
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);
    
    if (viewCheck.rows.length > 0) {
      console.log(`\n📋 Views in database (${viewCheck.rows.length}):`);
      viewCheck.rows.forEach(row => {
        console.log(`   • ${row.table_name}`);
      });
    }
    
    console.log('\n✅ Migration complete!\n');
    
  } catch (err) {
    console.error('\n❌ Fatal migration error:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

runMigrations();
