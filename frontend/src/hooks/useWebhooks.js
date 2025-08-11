import { useState, useEffect, useCallback } from 'react';
import { webhooksService } from '../services/webhooksService';

export function useWebhooks() {
  const [webhooks, setWebhooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchWebhooks = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await webhooksService.getWebhooks();
      setWebhooks(response.data || []);
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchWebhooks();
  }, [fetchWebhooks]);

  const createWebhook = async (webhookData) => {
    try {
      const response = await webhooksService.createWebhook(webhookData);
      
      // Add new webhook to the list
      setWebhooks(prev => [...prev, response.data]);
      
      return { success: true, data: response.data };
    } catch (err) {
      const message = err.response?.data?.error || err.message;
      return { success: false, error: message };
    }
  };

  const updateWebhook = async (webhookId, updates) => {
    try {
      const response = await webhooksService.updateWebhook(webhookId, updates);
      
      // Update webhook in the list
      setWebhooks(prev => prev.map(webhook => 
        webhook.id === webhookId ? response.data : webhook
      ));
      
      return { success: true, data: response.data };
    } catch (err) {
      const message = err.response?.data?.error || err.message;
      return { success: false, error: message };
    }
  };

  const deleteWebhook = async (webhookId) => {
    try {
      await webhooksService.deleteWebhook(webhookId);
      
      // Remove webhook from the list
      setWebhooks(prev => prev.filter(webhook => webhook.id !== webhookId));
      
      return { success: true };
    } catch (err) {
      const message = err.response?.data?.error || err.message;
      return { success: false, error: message };
    }
  };

  const testWebhook = async (webhookId) => {
    try {
      const response = await webhooksService.testWebhook(webhookId);
      return { success: true, data: response.data };
    } catch (err) {
      const message = err.response?.data?.error || err.message;
      return { success: false, error: message };
    }
  };

  return {
    webhooks,
    loading,
    error,
    createWebhook,
    updateWebhook,
    deleteWebhook,
    testWebhook,
    refreshWebhooks: fetchWebhooks,
  };
}

export function useWebhookDeliveries(webhookId) {
  const [deliveries, setDeliveries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pagination, setPagination] = useState({
    limit: 50,
    offset: 0,
    hasMore: false,
  });

  const fetchDeliveries = useCallback(async (params = {}) => {
    if (!webhookId) return;

    try {
      setLoading(true);
      setError(null);
      
      const response = await webhooksService.getWebhookDeliveries(webhookId, {
        ...pagination,
        ...params,
      });
      
      setDeliveries(response.data || []);
      setPagination(prev => ({
        ...prev,
        hasMore: response.data?.length === pagination.limit,
      }));
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setLoading(false);
    }
  }, [webhookId, pagination.limit, pagination.offset]);

  useEffect(() => {
    fetchDeliveries();
  }, [fetchDeliveries]);

  const loadMore = () => {
    if (!pagination.hasMore || loading) return;
    
    setPagination(prev => ({
      ...prev,
      offset: prev.offset + prev.limit,
    }));
  };

  return {
    deliveries,
    loading,
    error,
    pagination,
    loadMore,
    refreshDeliveries: () => fetchDeliveries(),
  };
}

export function useWebhookStats(webhookId = null) {
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchStats = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await webhooksService.getWebhookStats(webhookId);
      setStats(response.data || {});
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setLoading(false);
    }
  }, [webhookId]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  return {
    stats,
    loading,
    error,
    refreshStats: fetchStats,
  };
}

export function useWebhookEvents() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchEvents = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const response = await webhooksService.getWebhookEvents();
        setEvents(response.data || []);
      } catch (err) {
        setError(err.response?.data?.error || err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchEvents();
  }, []);

  return {
    events,
    loading,
    error,
  };
}