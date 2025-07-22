import pool from './database.js';
import supabase from './supabase.js';
import dotenv from 'dotenv';

dotenv.config();

// Determine which database to use
const USE_SUPABASE = process.env.USE_SUPABASE === 'true';

class DatabaseAdapter {
  constructor() {
    this.useSupabase = USE_SUPABASE;
  }

  // Query method that works with both PostgreSQL and Supabase
  async query(text, params = []) {
    if (this.useSupabase) {
      // For Supabase, we need to parse the SQL query and convert it
      // This is a simplified example - you may need more complex parsing
      return this.executeSupabaseQuery(text, params);
    } else {
      // Use regular PostgreSQL pool
      return pool.query(text, params);
    }
  }

  // Helper method to execute Supabase queries
  async executeSupabaseQuery(sql, params) {
    // This is a basic implementation
    // You'll need to enhance this based on your specific queries
    
    // Extract table name and operation from SQL
    const selectMatch = sql.match(/SELECT\s+(.+?)\s+FROM\s+(\w+)/i);
    const insertMatch = sql.match(/INSERT\s+INTO\s+(\w+)\s*\((.*?)\)\s*VALUES/i);
    const updateMatch = sql.match(/UPDATE\s+(\w+)\s+SET/i);
    const deleteMatch = sql.match(/DELETE\s+FROM\s+(\w+)/i);

    try {
      if (selectMatch) {
        const [, columns, table] = selectMatch;
        const query = supabase.from(table).select(columns === '*' ? '*' : columns);
        
        // Add WHERE conditions if present
        const whereMatch = sql.match(/WHERE\s+(.+?)(?:ORDER|GROUP|LIMIT|$)/i);
        if (whereMatch) {
          // This is simplified - you'd need more complex parsing for real queries
          const conditions = whereMatch[1];
          // Apply conditions to query
        }

        const { data, error } = await query;
        if (error) throw error;
        return { rows: data, rowCount: data.length };
      }

      if (insertMatch) {
        const [, table, columns] = insertMatch;
        const columnArray = columns.split(',').map(col => col.trim());
        
        // Build insert object from params
        const insertData = {};
        columnArray.forEach((col, index) => {
          insertData[col] = params[index];
        });

        const { data, error } = await supabase
          .from(table)
          .insert(insertData)
          .select();
          
        if (error) throw error;
        return { rows: data, rowCount: data.length };
      }

      if (updateMatch) {
        const [, table] = updateMatch;
        // Parse SET clause and WHERE clause
        // This would need more complex implementation
        
        const { data, error } = await supabase
          .from(table)
          .update({})  // Add parsed update data
          .match({});  // Add parsed where conditions
          
        if (error) throw error;
        return { rows: data, rowCount: data.length };
      }

      if (deleteMatch) {
        const [, table] = deleteMatch;
        // Parse WHERE clause
        
        const { data, error } = await supabase
          .from(table)
          .delete()
          .match({});  // Add parsed where conditions
          
        if (error) throw error;
        return { rows: data, rowCount: data.length };
      }

      // If no pattern matches, throw an error
      throw new Error('Unsupported SQL query pattern for Supabase adapter');
      
    } catch (error) {
      console.error('Supabase query error:', error);
      throw error;
    }
  }

  // Get a client for transactions (PostgreSQL only)
  async connect() {
    if (this.useSupabase) {
      // Supabase doesn't support traditional transactions in the same way
      // Return a mock client that uses Supabase
      return {
        query: (text, params) => this.query(text, params),
        release: () => Promise.resolve(),
        end: () => Promise.resolve()
      };
    }
    return pool.connect();
  }

  // Transaction support
  async transaction(callback) {
    if (this.useSupabase) {
      // Supabase doesn't have built-in transaction support
      // You might want to implement this differently
      return callback({
        query: (text, params) => this.query(text, params)
      });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  // Test connection
  async testConnection() {
    if (this.useSupabase) {
      const { testSupabaseConnection } = await import('./supabase.js');
      return testSupabaseConnection();
    }
    
    try {
      const result = await pool.query('SELECT NOW()');
      console.log('Database connected successfully');
      return true;
    } catch (error) {
      console.error('Database connection error:', error);
      return false;
    }
  }
}

// Export a singleton instance
const dbAdapter = new DatabaseAdapter();

// Also export the class for testing purposes
export { DatabaseAdapter };
export default dbAdapter;