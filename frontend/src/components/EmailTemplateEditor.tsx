import React, { useState, useEffect } from 'react';

interface EmailTemplate {
  id: string;
  doctor_email: string;
  template_name: string;
  subject_template: string;
  body_template: string;
  is_html: boolean;
  created_at: string;
  updated_at: string;
}

interface TemplateVariable {
  variable_name: string;
  description: string;
  example: string;
}

interface EmailTemplateEditorProps {
  apiUrl: string;
  doctorEmail: string;
}

const EmailTemplateEditor: React.FC<EmailTemplateEditorProps> = ({ apiUrl, doctorEmail }) => {
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [subjectTemplate, setSubjectTemplate] = useState('');
  const [bodyTemplate, setBodyTemplate] = useState('');
  const [isHtml, setIsHtml] = useState(false);
  const [variables, setVariables] = useState<TemplateVariable[]>([]);
  const [preview, setPreview] = useState<{ subject: string; body: string } | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchTemplates();
    fetchVariables();
  }, [doctorEmail]);

  const fetchTemplates = async () => {
    try {
      const response = await fetch(`${apiUrl}/api/email-templates/${doctorEmail}`);
      const data = await response.json();
      if (data.status === 'success') {
        setTemplates(data.templates);
      }
    } catch (error) {
      console.error('Failed to fetch templates:', error);
      showMessage('error', 'Failed to load templates');
    }
  };

  const fetchVariables = async () => {
    try {
      const response = await fetch(`${apiUrl}/api/email-templates/variables/reference`);
      const data = await response.json();
      if (data.status === 'success') {
        setVariables(data.variables);
      }
    } catch (error) {
      console.error('Failed to fetch variables:', error);
    }
  };

  const loadTemplate = (template: EmailTemplate) => {
    setSelectedTemplate(template.template_name);
    setSubjectTemplate(template.subject_template);
    setBodyTemplate(template.body_template);
    setIsHtml(template.is_html);
    setPreview(null);
  };

  const handleSaveTemplate = async () => {
    if (!selectedTemplate || !subjectTemplate || !bodyTemplate) {
      showMessage('error', 'Please select a template and fill in all fields');
      return;
    }

    try {
      setLoading(true);
      const response = await fetch(`${apiUrl}/api/email-templates`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          doctor_email: doctorEmail,
          template_name: selectedTemplate,
          subject_template: subjectTemplate,
          body_template: bodyTemplate,
          is_html: isHtml
        })
      });

      const data = await response.json();
      if (data.status === 'success') {
        showMessage('success', 'Template saved successfully!');
        fetchTemplates();
      } else {
        showMessage('error', data.message || 'Failed to save template');
      }
    } catch (error) {
      showMessage('error', 'Failed to save template');
    } finally {
      setLoading(false);
    }
  };

  const handlePreview = async () => {
    if (!subjectTemplate || !bodyTemplate) {
      showMessage('error', 'Please enter template content to preview');
      return;
    }

    try {
      const response = await fetch(`${apiUrl}/api/email-templates/preview`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject_template: subjectTemplate,
          body_template: bodyTemplate
        })
      });

      const data = await response.json();
      if (data.status === 'success') {
        setPreview(data.preview);
      } else {
        showMessage('error', 'Failed to generate preview');
      }
    } catch (error) {
      showMessage('error', 'Failed to generate preview');
    }
  };

  const insertVariable = (variableName: string, targetField: 'subject' | 'body') => {
    const variableTag = `{{${variableName}}}`;
    if (targetField === 'subject') {
      setSubjectTemplate(subjectTemplate + variableTag);
    } else {
      setBodyTemplate(bodyTemplate + variableTag);
    }
  };

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 5000);
  };

  return (
    <div className="w-full">
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-gray-800">Email Template Editor</h3>
        <p className="text-sm text-gray-600 mt-1">Customize email notifications for your patients</p>
      </div>

      {/* Message */}
      {message && (
            <div
              className={`mb-4 p-4 rounded-lg ${
                message.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'
              }`}
            >
              {message.text}
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left: Template List */}
            <div className="bg-gray-50 p-4 rounded-lg">
              <h3 className="font-semibold text-gray-800 mb-3">Your Templates</h3>
              <div className="space-y-2">
                {templates.length === 0 ? (
                  <p className="text-sm text-gray-500">No custom templates yet</p>
                ) : (
                  templates.map((template) => (
                    <button
                      key={template.id}
                      onClick={() => loadTemplate(template)}
                      className={`w-full text-left p-3 rounded border transition-colors ${
                        selectedTemplate === template.template_name
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-blue-300 bg-white'
                      }`}
                    >
                      <div className="font-medium text-sm">{template.template_name}</div>
                      <div className="text-xs text-gray-500 mt-1">
                        {template.is_html ? 'HTML' : 'Plain Text'}
                      </div>
                    </button>
                  ))
                )}
              </div>

              {/* Template Name Selection */}
              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select Template Type
                </label>
                <select
                  value={selectedTemplate || ''}
                  onChange={(e) => setSelectedTemplate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">-- Select Template --</option>
                  <option value="kidney_function_decline">Kidney Function Decline</option>
                  <option value="health_state_change">Health State Change</option>
                  <option value="poor_adherence">Poor Adherence</option>
                  <option value="home_monitoring_alert">Home Monitoring Alert</option>
                  <option value="abnormal_lab_value">Abnormal Lab Value</option>
                </select>
              </div>

              {/* Variables Reference */}
              <div className="mt-6">
                <h4 className="font-semibold text-gray-800 mb-2 text-sm">Available Variables</h4>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {variables.map((variable) => (
                    <div key={variable.variable_name} className="text-xs bg-white p-2 rounded border border-gray-200">
                      <div className="font-mono text-blue-600">
                        {'{{'}{variable.variable_name}{'}}'}
                      </div>
                      <div className="text-gray-600 mt-1">{variable.description}</div>
                      <div className="flex gap-2 mt-2">
                        <button
                          onClick={() => insertVariable(variable.variable_name, 'subject')}
                          className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                        >
                          → Subject
                        </button>
                        <button
                          onClick={() => insertVariable(variable.variable_name, 'body')}
                          className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded hover:bg-green-200"
                        >
                          → Body
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Middle: Template Editor */}
            <div className="lg:col-span-2">
              <div className="space-y-4">
                {/* Subject Template */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Subject Line
                  </label>
                  <input
                    type="text"
                    value={subjectTemplate}
                    onChange={(e) => setSubjectTemplate(e.target.value)}
                    placeholder="e.g., 🔻 ALERT: {{patient_name}} - Kidney Function Worsening"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* Body Template */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Email Body
                  </label>
                  <textarea
                    value={bodyTemplate}
                    onChange={(e) => setBodyTemplate(e.target.value)}
                    placeholder="Dear Dr. {{doctor_name}},&#10;&#10;Patient {{patient_name}} (MRN: {{mrn}})..."
                    rows={12}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                  />
                </div>

                {/* HTML Toggle */}
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="isHtml"
                    checked={isHtml}
                    onChange={(e) => setIsHtml(e.target.checked)}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <label htmlFor="isHtml" className="ml-2 text-sm text-gray-700">
                    Use HTML formatting
                  </label>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3">
                  <button
                    onClick={handlePreview}
                    className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Preview
                  </button>
                  <button
                    onClick={handleSaveTemplate}
                    disabled={loading || !selectedTemplate}
                    className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {loading ? 'Saving...' : 'Save Template'}
                  </button>
                </div>

                {/* Preview */}
                {preview && (
                  <div className="mt-6 border border-gray-300 rounded-lg p-4 bg-gray-50">
                    <h3 className="font-semibold text-gray-800 mb-3">Preview with Sample Data</h3>
                    <div className="bg-white p-4 rounded border border-gray-200">
                      <div className="font-semibold text-lg mb-2">{preview.subject}</div>
                      <div className="text-sm whitespace-pre-wrap">{preview.body}</div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
    </div>
  );
};

export default EmailTemplateEditor;
