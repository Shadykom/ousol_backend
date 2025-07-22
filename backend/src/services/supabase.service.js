import supabase from '../config/supabase.js';

class SupabaseService {
  // Auth methods
  async signUp(email, password, metadata = {}) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: metadata
      }
    });
    
    if (error) throw error;
    return data;
  }

  async signIn(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });
    
    if (error) throw error;
    return data;
  }

  async signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  }

  async getUser() {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error) throw error;
    return user;
  }

  async updateUser(updates) {
    const { data, error } = await supabase.auth.updateUser(updates);
    if (error) throw error;
    return data;
  }

  // Database methods
  async select(table, columns = '*', filters = {}) {
    let query = supabase.from(table).select(columns);
    
    // Apply filters
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        query = query.eq(key, value);
      }
    });
    
    const { data, error } = await query;
    if (error) throw error;
    return data;
  }

  async selectWithConditions(table, columns = '*', conditions = {}) {
    let query = supabase.from(table).select(columns);
    
    // Apply various conditions
    if (conditions.eq) {
      Object.entries(conditions.eq).forEach(([key, value]) => {
        query = query.eq(key, value);
      });
    }
    
    if (conditions.neq) {
      Object.entries(conditions.neq).forEach(([key, value]) => {
        query = query.neq(key, value);
      });
    }
    
    if (conditions.gt) {
      Object.entries(conditions.gt).forEach(([key, value]) => {
        query = query.gt(key, value);
      });
    }
    
    if (conditions.gte) {
      Object.entries(conditions.gte).forEach(([key, value]) => {
        query = query.gte(key, value);
      });
    }
    
    if (conditions.lt) {
      Object.entries(conditions.lt).forEach(([key, value]) => {
        query = query.lt(key, value);
      });
    }
    
    if (conditions.lte) {
      Object.entries(conditions.lte).forEach(([key, value]) => {
        query = query.lte(key, value);
      });
    }
    
    if (conditions.like) {
      Object.entries(conditions.like).forEach(([key, value]) => {
        query = query.like(key, value);
      });
    }
    
    if (conditions.ilike) {
      Object.entries(conditions.ilike).forEach(([key, value]) => {
        query = query.ilike(key, value);
      });
    }
    
    if (conditions.in) {
      Object.entries(conditions.in).forEach(([key, value]) => {
        query = query.in(key, value);
      });
    }
    
    if (conditions.orderBy) {
      const { column, ascending = true } = conditions.orderBy;
      query = query.order(column, { ascending });
    }
    
    if (conditions.limit) {
      query = query.limit(conditions.limit);
    }
    
    if (conditions.offset) {
      query = query.range(conditions.offset, conditions.offset + (conditions.limit || 10) - 1);
    }
    
    const { data, error } = await query;
    if (error) throw error;
    return data;
  }

  async insert(table, data) {
    const { data: insertedData, error } = await supabase
      .from(table)
      .insert(data)
      .select();
    
    if (error) throw error;
    return insertedData;
  }

  async update(table, data, filters) {
    let query = supabase.from(table).update(data);
    
    // Apply filters
    Object.entries(filters).forEach(([key, value]) => {
      query = query.eq(key, value);
    });
    
    const { data: updatedData, error } = await query.select();
    if (error) throw error;
    return updatedData;
  }

  async upsert(table, data, onConflict) {
    const { data: upsertedData, error } = await supabase
      .from(table)
      .upsert(data, { onConflict })
      .select();
    
    if (error) throw error;
    return upsertedData;
  }

  async delete(table, filters) {
    let query = supabase.from(table).delete();
    
    // Apply filters
    Object.entries(filters).forEach(([key, value]) => {
      query = query.eq(key, value);
    });
    
    const { data: deletedData, error } = await query.select();
    if (error) throw error;
    return deletedData;
  }

  // RPC (Remote Procedure Call) for database functions
  async rpc(functionName, params = {}) {
    const { data, error } = await supabase.rpc(functionName, params);
    if (error) throw error;
    return data;
  }

  // Real-time subscriptions
  subscribe(table, filters = {}, callback) {
    const channel = supabase
      .channel(`${table}_changes`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: table,
          filter: this.buildFilterString(filters)
        },
        callback
      )
      .subscribe();
    
    return channel;
  }

  unsubscribe(channel) {
    supabase.removeChannel(channel);
  }

  // Storage methods
  async uploadFile(bucket, path, file, options = {}) {
    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(path, file, options);
    
    if (error) throw error;
    return data;
  }

  async downloadFile(bucket, path) {
    const { data, error } = await supabase.storage
      .from(bucket)
      .download(path);
    
    if (error) throw error;
    return data;
  }

  async deleteFile(bucket, paths) {
    const { data, error } = await supabase.storage
      .from(bucket)
      .remove(paths);
    
    if (error) throw error;
    return data;
  }

  async getPublicUrl(bucket, path) {
    const { data } = supabase.storage
      .from(bucket)
      .getPublicUrl(path);
    
    return data.publicUrl;
  }

  // Helper methods
  buildFilterString(filters) {
    return Object.entries(filters)
      .map(([key, value]) => `${key}=eq.${value}`)
      .join(',');
  }

  // Get the Supabase client instance
  getClient() {
    return supabase;
  }
}

// Export singleton instance
const supabaseService = new SupabaseService();
export default supabaseService;