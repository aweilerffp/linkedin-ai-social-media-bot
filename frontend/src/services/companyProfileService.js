const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

class CompanyProfileService {
  async saveProfile(profileData) {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/marketing/company-profile`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(profileData)
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.message || 'Failed to save profile');
      }

      return result.data;
    } catch (error) {
      console.error('Error saving company profile:', error);
      throw error;
    }
  }

  async getProfile() {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/marketing/company-profile`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.message || 'Failed to fetch profile');
      }

      return result.data; // Can be null if no profile exists
    } catch (error) {
      console.error('Error fetching company profile:', error);
      throw error;
    }
  }

  async checkOnboardingStatus() {
    try {
      const profile = await this.getProfile();
      
      // Check if we have a complete profile
      if (!profile) {
        return { completed: false, reason: 'no_profile' };
      }

      // Check required fields
      if (!profile.company_name) {
        return { completed: false, reason: 'missing_company_name' };
      }

      // Check if brand voice is configured
      if (!profile.brand_voice || Object.keys(profile.brand_voice).length === 0) {
        return { completed: false, reason: 'missing_brand_voice' };
      }

      // Check if content pillars are configured
      if (!profile.content_pillars || profile.content_pillars.length === 0) {
        return { completed: false, reason: 'missing_content_pillars' };
      }

      return { 
        completed: true, 
        profile,
        reason: 'complete' 
      };
    } catch (error) {
      console.error('Error checking onboarding status:', error);
      // If API fails, fall back to localStorage check
      const legacyComplete = localStorage.getItem('onboarding_complete') === 'true';
      return { 
        completed: legacyComplete, 
        reason: legacyComplete ? 'legacy_complete' : 'api_error',
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