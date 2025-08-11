import { useState, useEffect, useCallback } from 'react';
import { postsService } from '../services/postsService';

export function usePosts(initialParams = {}) {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    hasMore: false,
  });

  const fetchPosts = useCallback(async (params = {}) => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await postsService.getPosts({
        ...initialParams,
        ...params,
      });

      setPosts(response.data.posts || []);
      setPagination(response.data.pagination || {});
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setLoading(false);
    }
  }, [initialParams]);

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  const createPost = async (postData) => {
    try {
      const response = await postsService.createPost(postData);
      
      // Add new post to the beginning of the list
      setPosts(prev => [response.data, ...prev]);
      
      return { success: true, data: response.data };
    } catch (err) {
      const message = err.response?.data?.error || err.message;
      return { success: false, error: message };
    }
  };

  const updatePost = async (postId, updates) => {
    try {
      const response = await postsService.updatePost(postId, updates);
      
      // Update post in the list
      setPosts(prev => prev.map(post => 
        post.id === postId ? response.data : post
      ));
      
      return { success: true, data: response.data };
    } catch (err) {
      const message = err.response?.data?.error || err.message;
      return { success: false, error: message };
    }
  };

  const deletePost = async (postId) => {
    try {
      await postsService.deletePost(postId);
      
      // Remove post from the list
      setPosts(prev => prev.filter(post => post.id !== postId));
      
      return { success: true };
    } catch (err) {
      const message = err.response?.data?.error || err.message;
      return { success: false, error: message };
    }
  };

  const postNow = async (postId) => {
    try {
      const response = await postsService.postNow(postId);
      
      // Update post status
      setPosts(prev => prev.map(post => 
        post.id === postId ? { ...post, status: 'queued' } : post
      ));
      
      return { success: true, data: response.data };
    } catch (err) {
      const message = err.response?.data?.error || err.message;
      return { success: false, error: message };
    }
  };

  const retryPost = async (postId, platform = null) => {
    try {
      const response = await postsService.retryPost(postId, platform);
      
      // Update post status
      setPosts(prev => prev.map(post => 
        post.id === postId ? { ...post, status: 'queued' } : post
      ));
      
      return { success: true, data: response.data };
    } catch (err) {
      const message = err.response?.data?.error || err.message;
      return { success: false, error: message };
    }
  };

  const refreshPosts = () => {
    fetchPosts();
  };

  return {
    posts,
    loading,
    error,
    pagination,
    createPost,
    updatePost,
    deletePost,
    postNow,
    retryPost,
    refreshPosts,
    fetchPosts,
  };
}

export function usePost(postId) {
  const [post, setPost] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!postId) return;

    const fetchPost = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const response = await postsService.getPost(postId);
        setPost(response.data);
      } catch (err) {
        setError(err.response?.data?.error || err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchPost();
  }, [postId]);

  return {
    post,
    loading,
    error,
  };
}

export function useScheduledPosts() {
  const [scheduledPosts, setScheduledPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchScheduledPosts = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await postsService.getScheduledPosts();
      setScheduledPosts(response.data || []);
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchScheduledPosts();
  }, [fetchScheduledPosts]);

  const cancelScheduled = async (postId) => {
    try {
      await postsService.cancelScheduled(postId);
      
      // Remove from scheduled posts
      setScheduledPosts(prev => prev.filter(post => post.id !== postId));
      
      return { success: true };
    } catch (err) {
      const message = err.response?.data?.error || err.message;
      return { success: false, error: message };
    }
  };

  return {
    scheduledPosts,
    loading,
    error,
    cancelScheduled,
    refreshScheduledPosts: fetchScheduledPosts,
  };
}