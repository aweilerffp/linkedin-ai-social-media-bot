import React, { useState, useEffect } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { toast } from 'react-hot-toast';

const CompanyProfileBuilder = ({ onSave, initialProfile = null, isLoading = false }) => {
  const [currentStep, setCurrentStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const totalSteps = 5;

  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    getValues,
    formState: { errors, isValid }
  } = useForm({
    defaultValues: {
      company_name: '',
      industry: '',
      brand_voice: {
        tone: [],
        keywords: [],
        prohibited_terms: []
      },
      content_pillars: [
        { title: '', description: '', keywords: [] }
      ],
      target_personas: [
        { name: '', pain_points: [], emotions: [] }
      ],
      evaluation_questions: [
        'What single insight do we most want the reader to remember?',
        'Which customer persona is priority #1 for this piece?',
        'What emotion should the reader feel?',
        'What action should they take next?',
        'Which examples or data points best support that goal?'
      ],
      visual_style: {
        colors: {
          primary: '#1A73E8',
          secondary: '#34A853',
          accent: '#FBBC04'
        },
        illustration_style: {
          type: 'modern',
          characteristics: ['clean lines', 'professional']
        },
        visual_elements: {
          industry: '',
          common_elements: []
        },
        restrictions: ['no text in images', 'generous padding']
      },
      slack_config: {
        channel: '#social-media',
        approvers: []
      }
    }
  });

  const {
    fields: pillarFields,
    append: appendPillar,
    remove: removePillar
  } = useFieldArray({
    control,
    name: 'content_pillars'
  });

  const {
    fields: personaFields,
    append: appendPersona,
    remove: removePersona
  } = useFieldArray({
    control,
    name: 'target_personas'
  });

  const {
    fields: questionFields,
    append: appendQuestion,
    remove: removeQuestion
  } = useFieldArray({
    control,
    name: 'evaluation_questions'
  });

  // Load initial profile data
  useEffect(() => {
    if (initialProfile) {
      Object.keys(initialProfile).forEach(key => {
        setValue(key, initialProfile[key]);
      });
    }
  }, [initialProfile, setValue]);

  const onSubmit = async (data) => {
    setSaving(true);
    try {
      await onSave(data);
      toast.success('Company profile saved successfully!');
    } catch (error) {
      toast.error('Failed to save profile: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const nextStep = () => {
    if (currentStep < totalSteps) {
      setCurrentStep(currentStep + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleArrayInput = (fieldName, value) => {
    if (value.includes(',')) {
      return value.split(',').map(item => item.trim()).filter(item => item);
    }
    return value;
  };

  const industries = [
    'ecommerce',
    'saas',
    'consulting',
    'healthcare',
    'finance',
    'education',
    'manufacturing',
    'retail',
    'technology',
    'marketing'
  ];

  const toneOptions = [
    'professional', 'friendly', 'authoritative', 'conversational', 
    'technical', 'approachable', 'confident', 'practical',
    'innovative', 'solution-focused', 'educational', 'inspiring'
  ];

  const illustrationStyles = [
    { value: 'isometric', label: 'Isometric (3D technical)' },
    { value: 'flat', label: 'Flat Design (2D minimal)' },
    { value: 'modern', label: 'Modern (clean interfaces)' },
    { value: 'corporate', label: 'Corporate (business professional)' },
    { value: 'tech', label: 'Tech/Futuristic' },
    { value: 'hand-drawn', label: 'Hand-drawn (sketch style)' }
  ];

  const renderStepIndicator = () => (
    <div className="flex items-center justify-center mb-8">
      {[...Array(totalSteps)].map((_, index) => (
        <React.Fragment key={index}>
          <div
            className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
              index + 1 <= currentStep
                ? 'bg-blue-600 text-white'
                : 'bg-gray-200 text-gray-600'
            }`}
          >
            {index + 1}
          </div>
          {index < totalSteps - 1 && (
            <div
              className={`w-12 h-1 mx-2 ${
                index + 1 < currentStep ? 'bg-blue-600' : 'bg-gray-200'
              }`}
            />
          )}
        </React.Fragment>
      ))}
    </div>
  );

  const renderStep1 = () => (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900">Company Information</h2>
      
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Company Name *
        </label>
        <input
          {...register('company_name', { required: 'Company name is required' })}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="e.g., FlatFilePro"
        />
        {errors.company_name && (
          <p className="mt-1 text-sm text-red-600">{errors.company_name.message}</p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Industry *
        </label>
        <select
          {...register('industry', { required: 'Industry is required' })}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Select an industry</option>
          {industries.map(industry => (
            <option key={industry} value={industry}>
              {industry.charAt(0).toUpperCase() + industry.slice(1)}
            </option>
          ))}
        </select>
        {errors.industry && (
          <p className="mt-1 text-sm text-red-600">{errors.industry.message}</p>
        )}
      </div>
    </div>
  );

  const renderStep2 = () => (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900">Brand Voice</h2>
      
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Brand Tone (select 3-5)
        </label>
        <div className="grid grid-cols-3 gap-2">
          {toneOptions.map(tone => (
            <label key={tone} className="flex items-center">
              <input
                type="checkbox"
                value={tone}
                {...register('brand_voice.tone')}
                className="mr-2"
              />
              <span className="text-sm">{tone}</span>
            </label>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Industry Keywords (comma-separated)
        </label>
        <textarea
          {...register('brand_voice.keywords')}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          rows={3}
          placeholder="e.g., Amazon, listings, catalog, ASIN, optimization"
          onChange={(e) => setValue('brand_voice.keywords', handleArrayInput('keywords', e.target.value))}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Prohibited Terms (comma-separated)
        </label>
        <textarea
          {...register('brand_voice.prohibited_terms')}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          rows={2}
          placeholder="e.g., revolutionary, game-changing, paradigm"
          onChange={(e) => setValue('brand_voice.prohibited_terms', handleArrayInput('prohibited_terms', e.target.value))}
        />
      </div>
    </div>
  );

  const renderStep3 = () => (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900">Content Strategy</h2>
      
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Content Pillars</h3>
          <button
            type="button"
            onClick={() => appendPillar({ title: '', description: '', keywords: [] })}
            className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Add Pillar
          </button>
        </div>
        
        {pillarFields.map((field, index) => (
          <div key={field.id} className="p-4 border border-gray-200 rounded-md space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-medium">Pillar #{index + 1}</h4>
              {index > 0 && (
                <button
                  type="button"
                  onClick={() => removePillar(index)}
                  className="text-red-600 hover:text-red-800"
                >
                  Remove
                </button>
              )}
            </div>
            
            <input
              {...register(`content_pillars.${index}.title`)}
              placeholder="Pillar title"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            
            <textarea
              {...register(`content_pillars.${index}.description`)}
              placeholder="Description"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={2}
            />
          </div>
        ))}
      </div>

      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Target Personas</h3>
          <button
            type="button"
            onClick={() => appendPersona({ name: '', pain_points: [], emotions: [] })}
            className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Add Persona
          </button>
        </div>
        
        {personaFields.map((field, index) => (
          <div key={field.id} className="p-4 border border-gray-200 rounded-md space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-medium">Persona #{index + 1}</h4>
              {index > 0 && (
                <button
                  type="button"
                  onClick={() => removePersona(index)}
                  className="text-red-600 hover:text-red-800"
                >
                  Remove
                </button>
              )}
            </div>
            
            <input
              {...register(`target_personas.${index}.name`)}
              placeholder="Persona name (e.g., Amazon Sellers)"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            
            <textarea
              {...register(`target_personas.${index}.pain_points`)}
              placeholder="Pain points (comma-separated)"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={2}
              onChange={(e) => setValue(`target_personas.${index}.pain_points`, handleArrayInput('pain_points', e.target.value))}
            />
            
            <input
              {...register(`target_personas.${index}.emotions`)}
              placeholder="Target emotions (comma-separated)"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              onChange={(e) => setValue(`target_personas.${index}.emotions`, handleArrayInput('emotions', e.target.value))}
            />
          </div>
        ))}
      </div>
    </div>
  );

  const renderStep4 = () => (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900">Visual Style Guide</h2>
      
      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Primary Color
          </label>
          <input
            type="color"
            {...register('visual_style.colors.primary')}
            className="w-full h-10 border border-gray-300 rounded-md"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Secondary Color
          </label>
          <input
            type="color"
            {...register('visual_style.colors.secondary')}
            className="w-full h-10 border border-gray-300 rounded-md"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Accent Color
          </label>
          <input
            type="color"
            {...register('visual_style.colors.accent')}
            className="w-full h-10 border border-gray-300 rounded-md"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Illustration Style
        </label>
        <select
          {...register('visual_style.illustration_style.type')}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {illustrationStyles.map(style => (
            <option key={style.value} value={style.value}>
              {style.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Visual Elements (comma-separated)
        </label>
        <textarea
          {...register('visual_style.visual_elements.common_elements')}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          rows={3}
          placeholder="e.g., dashboards, interfaces, data visualizations"
          onChange={(e) => setValue('visual_style.visual_elements.common_elements', handleArrayInput('common_elements', e.target.value))}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Image Restrictions (comma-separated)
        </label>
        <textarea
          {...register('visual_style.restrictions')}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          rows={2}
          placeholder="e.g., no text in images, generous padding"
          onChange={(e) => setValue('visual_style.restrictions', handleArrayInput('restrictions', e.target.value))}
        />
      </div>
    </div>
  );

  const renderStep5 = () => (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900">Evaluation Questions</h2>
      <p className="text-gray-600">
        These questions guide the AI in generating relevant marketing insights.
      </p>
      
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Custom Evaluation Questions</h3>
          <button
            type="button"
            onClick={() => appendQuestion('')}
            className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Add Question
          </button>
        </div>
        
        {questionFields.map((field, index) => (
          <div key={field.id} className="flex items-center space-x-2 mb-3">
            <span className="text-sm text-gray-500 w-8">{index + 1}.</span>
            <input
              {...register(`evaluation_questions.${index}`)}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter evaluation question"
            />
            {index >= 5 && (
              <button
                type="button"
                onClick={() => removeQuestion(index)}
                className="text-red-600 hover:text-red-800"
              >
                Remove
              </button>
            )}
          </div>
        ))}
      </div>

      <div className="bg-blue-50 p-4 rounded-md">
        <h4 className="font-medium text-blue-900 mb-2">Slack Configuration</h4>
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-blue-800 mb-1">
              Approval Channel
            </label>
            <input
              {...register('slack_config.channel')}
              className="w-full px-3 py-2 border border-blue-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="#social-media"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-blue-800 mb-1">
              Approver User IDs (comma-separated)
            </label>
            <input
              {...register('slack_config.approvers')}
              className="w-full px-3 py-2 border border-blue-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="U1234567890, U0987654321"
              onChange={(e) => setValue('slack_config.approvers', handleArrayInput('approvers', e.target.value))}
            />
            <p className="text-xs text-blue-600 mt-1">
              Find user IDs in Slack: Right-click user → Copy Member ID
            </p>
          </div>
        </div>
      </div>
    </div>
  );

  const renderCurrentStep = () => {
    switch (currentStep) {
      case 1: return renderStep1();
      case 2: return renderStep2();
      case 3: return renderStep3();
      case 4: return renderStep4();
      case 5: return renderStep5();
      default: return renderStep1();
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-2 text-gray-600">Loading company profile...</span>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="bg-white rounded-lg shadow-lg p-8">
        {renderStepIndicator()}
        
        <form onSubmit={handleSubmit(onSubmit)}>
          {renderCurrentStep()}
          
          <div className="flex justify-between mt-8">
            <button
              type="button"
              onClick={prevStep}
              disabled={currentStep === 1}
              className={`px-6 py-2 rounded-md font-medium ${
                currentStep === 1
                  ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                  : 'bg-gray-600 text-white hover:bg-gray-700'
              }`}
            >
              Previous
            </button>
            
            <div className="flex space-x-4">
              {currentStep < totalSteps ? (
                <button
                  type="button"
                  onClick={nextStep}
                  className="px-6 py-2 bg-blue-600 text-white rounded-md font-medium hover:bg-blue-700"
                >
                  Next
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={saving}
                  className={`px-6 py-2 rounded-md font-medium ${
                    saving
                      ? 'bg-blue-400 cursor-not-allowed'
                      : 'bg-green-600 hover:bg-green-700'
                  } text-white`}
                >
                  {saving ? 'Saving...' : 'Save Profile'}
                </button>
              )}
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CompanyProfileBuilder;