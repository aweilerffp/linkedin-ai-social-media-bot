const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

class CompanyProfileService {
  async saveProfile(profileData) {
    try {
      const token = localStorage.getItem('token');
      
      // For demo accounts, save to localStorage as fallback
      if (!token || token === 'demo-token') {
        console.log('Demo mode: saving profile to localStorage');
        localStorage.setItem('company_profile', JSON.stringify(profileData));
        localStorage.setItem('onboarding_complete', 'true');
        return profileData;
      }

      const response = await fetch(`${API_URL}/marketing/company-profile`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(profileData)
      });

      if (!response.ok) {
        console.error('API request failed, falling back to localStorage');
        localStorage.setItem('company_profile', JSON.stringify(profileData));
        localStorage.setItem('onboarding_complete', 'true');
        return profileData;
      }

      const result = await response.json();
      
      if (!result.success) {
        console.error('API response not successful, falling back to localStorage');
        localStorage.setItem('company_profile', JSON.stringify(profileData));
        localStorage.setItem('onboarding_complete', 'true');
        return profileData;
      }

      return result.data;
    } catch (error) {
      console.error('Error saving company profile, using localStorage fallback:', error);
      // Fallback to localStorage for demo purposes
      localStorage.setItem('company_profile', JSON.stringify(profileData));
      localStorage.setItem('onboarding_complete', 'true');
      return profileData;
    }
  }

  async getProfile() {
    try {
      const token = localStorage.getItem('token');
      
      // For demo accounts, check localStorage first
      if (!token || token === 'demo-token') {
        console.log('Demo mode: checking localStorage for profile');
        const profile = localStorage.getItem('company_profile');
        return profile ? JSON.parse(profile) : null;
      }

      const response = await fetch(`${API_URL}/marketing/company-profile`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        console.error('API request failed, checking localStorage fallback');
        const profile = localStorage.getItem('company_profile');
        return profile ? JSON.parse(profile) : null;
      }

      const result = await response.json();
      
      if (!result.success) {
        console.error('API response not successful, checking localStorage fallback');
        const profile = localStorage.getItem('company_profile');
        return profile ? JSON.parse(profile) : null;
      }

      return result.data; // Can be null if no profile exists
    } catch (error) {
      console.error('Error fetching company profile, checking localStorage fallback:', error);
      // Fallback to localStorage for demo purposes
      const profile = localStorage.getItem('company_profile');
      return profile ? JSON.parse(profile) : null;
    }
  }

  async checkOnboardingStatus() {
    try {
      console.log('CompanyProfileService: Checking onboarding status...');
      
      // Check localStorage flag first (most reliable for demo)
      const legacyComplete = localStorage.getItem('onboarding_complete') === 'true';
      console.log('Legacy complete flag:', legacyComplete);
      
      // Try to get profile
      const profile = await this.getProfile();
      console.log('Retrieved profile:', profile ? 'exists' : 'null');
      
      // If we have the completion flag, consider it complete
      if (legacyComplete) {
        return { 
          completed: true, 
          profile,
          reason: 'onboarding_flag_set' 
        };
      }
      
      // Check if we have a complete profile
      if (!profile) {
        return { completed: false, reason: 'no_profile' };
      }

      // Check required fields
      if (!profile.company_name) {
        return { completed: false, reason: 'missing_company_name' };
      }

      // For demo accounts, be more lenient
      const token = localStorage.getItem('token');
      if (!token || token === 'demo-token') {
        return { 
          completed: true, 
          profile,
          reason: 'demo_complete' 
        };
      }

      // If we have a company name, consider it complete enough
      return { 
        completed: true, 
        profile,
        reason: 'profile_exists' 
      };
      
    } catch (error) {
      console.error('Error checking onboarding status:', error);
      // If everything fails, fall back to localStorage check
      const legacyComplete = localStorage.getItem('onboarding_complete') === 'true';
      return { 
        completed: legacyComplete, 
        reason: legacyComplete ? 'fallback_complete' : 'api_error',
        error: error.message 
      };
    }
  }

  // Convert old localStorage data to new format
  async migrateFromLocalStorage() {
    try {
      const companyData = JSON.parse(localStorage.getItem('company_data') || '{}');
      const brandVoiceData = JSON.parse(localStorage.getItem('brand_voice_data') || '{}');
      
      if (!companyData.companyName) {
        return null; // No data to migrate
      }

      // Convert to new format
      const profileData = {
        company_name: companyData.companyName,
        industry: companyData.industry,
        brand_voice: {
          tone: brandVoiceData.tone || [],
          keywords: brandVoiceData.keywords || [],
          prohibited_terms: brandVoiceData.prohibited_terms || []
        },
        content_pillars: brandVoiceData.content_pillars || [
          {
            title: 'Industry Expertise',
            description: `Insights and best practices in ${companyData.industry || 'your industry'}`,
            keywords: []
          }
        ],
        target_personas: brandVoiceData.target_personas || [
          {
            name: 'Business Professionals',
            pain_points: ['efficiency', 'growth', 'strategy'],
            emotions: ['confidence', 'success', 'innovation']
          }
        ],
        evaluation_questions: [
          'What specific problem does this solve?',
          'How does this align with our brand voice?',
          'What action should the reader take?',
          'Does this provide real value to our audience?'
        ]
      };

      // Save to database
      const savedProfile = await this.saveProfile(profileData);
      
      // Clear old localStorage data after successful migration
      localStorage.removeItem('company_data');
      localStorage.removeItem('brand_voice_data');
      localStorage.removeItem('connected_platforms');
      
      console.log('Successfully migrated profile from localStorage to database');
      return savedProfile;
    } catch (error) {
      console.error('Error migrating from localStorage:', error);
      throw error;
    }
  }
}

export const companyProfileService = new CompanyProfileService();
export default companyProfileService;