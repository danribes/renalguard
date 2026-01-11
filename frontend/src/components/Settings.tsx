import React, { useState, useEffect } from 'react';
import EmailTemplateEditor from './EmailTemplateEditor';

interface EmailConfig {
  doctor_email: string;
  enabled: boolean;
  configured: boolean;
  smtp_configured: boolean;
  from_email?: string;
  from_name?: string;
  notify_ckd_transitions?: boolean;
  notify_lab_updates?: boolean;
  notify_significant_changes?: boolean;
  notify_clinical_alerts?: boolean;
}

interface EmailMessage {
  id: string;
  to_email: string;
  subject: string;
  message: string;
  status: 'sent' | 'failed' | 'pending';
  email_message_id: string | null;
  error_message: string | null;
  sent_at: string;
}

interface SettingsProps {
  apiUrl: string;
  onClose?: () => void;
}

const Settings: React.FC<SettingsProps> = ({ apiUrl, onClose }) => {
  const [activeTab, setActiveTab] = useState<'email' | 'templates' | 'history'>('email');

  // Email configuration state
  const [emailConfig, setEmailConfig] = useState<EmailConfig>({
    doctor_email: '',
    enabled: false,
    configured: false,
    smtp_configured: false,
  });

  // Form state
  const [doctorEmail, setDoctorEmail] = useState('');
  const [emailEnabled, setEmailEnabled] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [smtpHost, setSmtpHost] = useState('');
  const [smtpPort, setSmtpPort] = useState('587');
  const [smtpUser, setSmtpUser] = useState('');
  const [smtpPassword, setSmtpPassword] = useState('');
  const [fromEmail, setFromEmail] = useState('');
  const [fromName, setFromName] = useState('CKD Analyzer System');

  // Notification preferences state
  const [notifyCkdTransitions, setNotifyCkdTransitions] = useState(true);
  const [notifyLabUpdates, setNotifyLabUpdates] = useState(false);
  const [notifySignificantChanges, setNotifySignificantChanges] = useState(true);
  const [notifyClinicalAlerts, setNotifyClinicalAlerts] = useState(true);

  // Message history state
  const [emailMessages, setEmailMessages] = useState<EmailMessage[]>([]);
  const [totalMessages, setTotalMessages] = useState(0);

  // UI state
  const [loading, setLoading] = useState(false);
  const [testingEmail, setTestingEmail] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [testEmailResult, setTestEmailResult] = useState<{ success: boolean; message: string; previewUrl?: string } | null>(null);

  useEffect(() => {
    fetchEmailConfig();
    fetchEmailHistory();
  }, []);

  const fetchEmailConfig = async () => {
    try {
      const response = await fetch(`${apiUrl}/api/settings/email`);
      const data = await response.json();

      if (data.status === 'success' && data.data) {
        setEmailConfig(data.data);
        setDoctorEmail(data.data.doctor_email || '');
        setEmailEnabled(data.data.enabled || false);
        setFromEmail(data.data.from_email || '');
        setFromName(data.data.from_name || 'CKD Analyzer System');
        setNotifyCkdTransitions(data.data.notify_ckd_transitions !== undefined ? data.data.notify_ckd_transitions : true);
        setNotifyLabUpdates(data.data.notify_lab_updates !== undefined ? data.data.notify_lab_updates : false);
        setNotifySignificantChanges(data.data.notify_significant_changes !== undefined ? data.data.notify_significant_changes : true);
        setNotifyClinicalAlerts(data.data.notify_clinical_alerts !== undefined ? data.data.notify_clinical_alerts : true);
      }
    } catch (error) {
      console.error('Failed to fetch email config:', error);
      showMessage('error', 'Failed to load email configuration');
    }
  };

  const fetchEmailHistory = async () => {
    try {
      const response = await fetch(`${apiUrl}/api/settings/email/messages?limit=50`);
      const data = await response.json();

      if (data.status === 'success' && data.data) {
        setEmailMessages(data.data.messages);
        setTotalMessages(data.data.total);
      }
    } catch (error) {
      console.error('Failed to fetch email history:', error);
    }
  };

  const handleSaveConfig = async () => {
    if (!doctorEmail) {
      showMessage('error', 'Please enter a doctor email address');
      return;
    }

    try {
      setLoading(true);
      const payload: any = {
        doctor_email: doctorEmail,
        enabled: emailEnabled,
        notify_ckd_transitions: notifyCkdTransitions,
        notify_lab_updates: notifyLabUpdates,
        notify_significant_changes: notifySignificantChanges,
        notify_clinical_alerts: notifyClinicalAlerts,
      };

      if (showAdvanced && smtpHost) {
        payload.smtp_host = smtpHost;
        payload.smtp_port = smtpPort;
        payload.smtp_user = smtpUser;
        payload.smtp_password = smtpPassword;
        payload.from_email = fromEmail;
        payload.from_name = fromName;
      }

      const response = await fetch(`${apiUrl}/api/settings/email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (data.status === 'success') {
        showMessage('success', 'Email configuration saved successfully!');
        await fetchEmailConfig();
      } else {
        showMessage('error', data.message || 'Failed to save configuration');
      }
    } catch (error) {
      showMessage('error', 'Failed to save email configuration');
    } finally {
      setLoading(false);
    }
  };

  const handleTestEmail = async () => {
    if (!emailConfig.configured) {
      showMessage('error', 'Please configure and save email settings first');
      return;
    }

    try {
      setTestingEmail(true);
      setTestEmailResult(null);

      const response = await fetch(`${apiUrl}/api/settings/email/test`, {
        method: 'POST',
      });

      const data = await response.json();

      if (data.status === 'success') {
        setTestEmailResult({
          success: true,
          message: data.message,
          previewUrl: data.previewUrl,
        });
        showMessage('success', 'Test email sent successfully!');
        await fetchEmailHistory();
      } else {
        setTestEmailResult({
          success: false,
          message: data.message,
        });
        showMessage('error', data.message || 'Failed to send test email');
      }
    } catch (error) {
      showMessage('error', 'Failed to send test email');
      setTestEmailResult({
        success: false,
        message: 'Network error occurred',
      });
    } finally {
      setTestingEmail(false);
    }
  };

  const showMessage = (type: 'success' | 'error' | 'info', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 5000);
  };

  const getStatusBadge = (status: string) => {
    const styles = {
      sent: 'bg-green-100 text-green-800',
      failed: 'bg-red-100 text-red-800',
      pending: 'bg-yellow-100 text-yellow-800',
    };
    return (
      <span className={`px-2 py-1 text-xs font-semibold rounded ${styles[status as keyof typeof styles] || 'bg-gray-100 text-gray-800'}`}>
        {status.toUpperCase()}
      </span>
    );
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full my-8">
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4 flex justify-between items-center rounded-t-lg">
          <div>
            <h2 className="text-2xl font-bold text-white">Settings</h2>
            <p className="text-sm text-blue-100 mt-1">Configure email notifications and templates</p>
          </div>
          {onClose && (
            <button onClick={onClose} className="text-white hover:text-gray-200">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* Message */}
        {message && (
          <div className="px-6 pt-4">
            <div
              className={`p-4 rounded-lg ${
                message.type === 'success'
                  ? 'bg-green-50 text-green-800 border border-green-200'
                  : message.type === 'error'
                  ? 'bg-red-50 text-red-800 border border-red-200'
                  : 'bg-blue-50 text-blue-800 border border-blue-200'
              }`}
            >
              {message.text}
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="border-b border-gray-200 px-6">
          <nav className="flex space-x-8 -mb-px">
            <button
              onClick={() => setActiveTab('email')}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'email'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Email Configuration
            </button>
            <button
              onClick={() => setActiveTab('templates')}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'templates'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Email Templates
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'history'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Email History
              {totalMessages > 0 && (
                <span className="ml-2 bg-blue-100 text-blue-600 text-xs px-2 py-0.5 rounded-full">
                  {totalMessages}
                </span>
              )}
            </button>
          </nav>
        </div>

        {/* Tab Content */}
        <div className="p-6 max-h-[70vh] overflow-y-auto">
          {/* Email Configuration Tab */}
          {activeTab === 'email' && (
            <div className="space-y-6">
              {/* Status Banner */}
              <div className={`p-4 rounded-lg ${emailConfig.configured ? 'bg-green-50 border border-green-200' : 'bg-yellow-50 border border-yellow-200'}`}>
                <div className="flex items-center">
                  <div className={`w-3 h-3 rounded-full mr-3 ${emailConfig.configured ? 'bg-green-500' : 'bg-yellow-500'}`}></div>
                  <div>
                    <p className={`font-semibold ${emailConfig.configured ? 'text-green-800' : 'text-yellow-800'}`}>
                      {emailConfig.configured ? 'Email Configured' : 'Email Not Configured'}
                    </p>
                    <p className={`text-sm ${emailConfig.configured ? 'text-green-600' : 'text-yellow-600'}`}>
                      {emailConfig.configured
                        ? emailConfig.smtp_configured
                          ? 'Using custom SMTP server'
                          : 'Using test email account (emails viewable via preview link)'
                        : 'Please configure your email settings below'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Basic Settings */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-800">Basic Settings</h3>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Doctor Email Address <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    value={doctorEmail}
                    onChange={(e) => setDoctorEmail(e.target.value)}
                    placeholder="doctor@example.com"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                  <p className="text-sm text-gray-500 mt-1">
                    This email will receive all patient alert notifications
                  </p>
                </div>

                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="emailEnabled"
                    checked={emailEnabled}
                    onChange={(e) => setEmailEnabled(e.target.checked)}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <label htmlFor="emailEnabled" className="ml-2 text-sm font-medium text-gray-700">
                    Enable email notifications
                  </label>
                </div>
              </div>

              {/* Notification Preferences */}
              <div className="border-t pt-4">
                <h3 className="text-lg font-semibold text-gray-800 mb-3">Notification Preferences</h3>
                <p className="text-sm text-gray-500 mb-4">
                  Choose when you want to receive email notifications
                </p>

                <div className="space-y-3">
                  <div className="flex items-start">
                    <input
                      type="checkbox"
                      id="notifyCkdTransitions"
                      checked={notifyCkdTransitions}
                      onChange={(e) => setNotifyCkdTransitions(e.target.checked)}
                      className="mt-1 w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <div className="ml-3">
                      <label htmlFor="notifyCkdTransitions" className="text-sm font-medium text-gray-700">
                        CKD Status Transitions
                      </label>
                      <p className="text-xs text-gray-500">
                        When patient transitions between CKD and Non-CKD status
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start">
                    <input
                      type="checkbox"
                      id="notifySignificantChanges"
                      checked={notifySignificantChanges}
                      onChange={(e) => setNotifySignificantChanges(e.target.checked)}
                      className="mt-1 w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <div className="ml-3">
                      <label htmlFor="notifySignificantChanges" className="text-sm font-medium text-gray-700">
                        Significant Lab Changes
                      </label>
                      <p className="text-xs text-gray-500">
                        eGFR decline &gt;10% or uACR increase &gt;30%
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start">
                    <input
                      type="checkbox"
                      id="notifyLabUpdates"
                      checked={notifyLabUpdates}
                      onChange={(e) => setNotifyLabUpdates(e.target.checked)}
                      className="mt-1 w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <div className="ml-3">
                      <label htmlFor="notifyLabUpdates" className="text-sm font-medium text-gray-700">
                        All Lab Updates
                      </label>
                      <p className="text-xs text-gray-500">
                        Every patient lab update (may generate many emails)
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start">
                    <input
                      type="checkbox"
                      id="notifyClinicalAlerts"
                      checked={notifyClinicalAlerts}
                      onChange={(e) => setNotifyClinicalAlerts(e.target.checked)}
                      className="mt-1 w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <div className="ml-3">
                      <label htmlFor="notifyClinicalAlerts" className="text-sm font-medium text-gray-700">
                        Clinical Alerts
                      </label>
                      <p className="text-xs text-gray-500">
                        Rapid progression, severe values, adherence issues
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Advanced SMTP Settings */}
              <div className="border-t pt-4">
                <button
                  onClick={() => setShowAdvanced(!showAdvanced)}
                  className="flex items-center text-blue-600 hover:text-blue-700 font-medium"
                >
                  <svg
                    className={`w-5 h-5 mr-2 transform transition-transform ${showAdvanced ? 'rotate-90' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                  Advanced SMTP Settings (Optional)
                </button>
                <p className="text-sm text-gray-500 mt-1 ml-7">
                  Leave empty to use test email account (recommended for development)
                </p>

                {showAdvanced && (
                  <div className="mt-4 space-y-4 pl-7">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          SMTP Host
                        </label>
                        <input
                          type="text"
                          value={smtpHost}
                          onChange={(e) => setSmtpHost(e.target.value)}
                          placeholder="smtp.gmail.com"
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          SMTP Port
                        </label>
                        <input
                          type="number"
                          value={smtpPort}
                          onChange={(e) => setSmtpPort(e.target.value)}
                          placeholder="587"
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          SMTP Username
                        </label>
                        <input
                          type="text"
                          value={smtpUser}
                          onChange={(e) => setSmtpUser(e.target.value)}
                          placeholder="your-email@gmail.com"
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          SMTP Password
                        </label>
                        <input
                          type="password"
                          value={smtpPassword}
                          onChange={(e) => setSmtpPassword(e.target.value)}
                          placeholder="your-app-password"
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          From Email
                        </label>
                        <input
                          type="email"
                          value={fromEmail}
                          onChange={(e) => setFromEmail(e.target.value)}
                          placeholder="noreply@ckd-analyzer.com"
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          From Name
                        </label>
                        <input
                          type="text"
                          value={fromName}
                          onChange={(e) => setFromName(e.target.value)}
                          placeholder="CKD Analyzer System"
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-4 border-t">
                <button
                  onClick={handleSaveConfig}
                  disabled={loading}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
                >
                  {loading ? 'Saving...' : 'Save Configuration'}
                </button>
                <button
                  onClick={handleTestEmail}
                  disabled={testingEmail || !emailConfig.configured}
                  className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
                >
                  {testingEmail ? 'Sending...' : 'Send Test Email'}
                </button>
              </div>

              {/* Test Email Result */}
              {testEmailResult && (
                <div className={`p-4 rounded-lg ${testEmailResult.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
                  <p className={`font-semibold ${testEmailResult.success ? 'text-green-800' : 'text-red-800'}`}>
                    {testEmailResult.success ? 'Test Email Sent!' : 'Test Email Failed'}
                  </p>
                  <p className={`text-sm mt-1 ${testEmailResult.success ? 'text-green-600' : 'text-red-600'}`}>
                    {testEmailResult.message}
                  </p>
                  {testEmailResult.previewUrl && (
                    <a
                      href={testEmailResult.previewUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-block mt-2 text-sm text-blue-600 hover:text-blue-700 underline"
                    >
                      View Test Email
                    </a>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Email Templates Tab */}
          {activeTab === 'templates' && (
            <div>
              {emailConfig.configured ? (
                <EmailTemplateEditor
                  apiUrl={apiUrl}
                  doctorEmail={doctorEmail}
                />
              ) : (
                <div className="text-center py-12">
                  <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  <p className="text-gray-600 font-medium">Email Not Configured</p>
                  <p className="text-sm text-gray-500 mt-2">
                    Please configure your email settings in the Email Configuration tab first
                  </p>
                  <button
                    onClick={() => setActiveTab('email')}
                    className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    Go to Email Configuration
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Email History Tab */}
          {activeTab === 'history' && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-800">Email History</h3>
                <button
                  onClick={fetchEmailHistory}
                  className="px-3 py-1 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Refresh
                </button>
              </div>

              {emailMessages.length === 0 ? (
                <div className="text-center py-12">
                  <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                  </svg>
                  <p className="text-gray-600">No emails sent yet</p>
                  <p className="text-sm text-gray-500 mt-2">
                    Email history will appear here once notifications are sent
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {emailMessages.map((msg) => (
                    <div key={msg.id} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3">
                            {getStatusBadge(msg.status)}
                            <span className="text-sm text-gray-500">
                              {new Date(msg.sent_at).toLocaleString()}
                            </span>
                          </div>
                          <h4 className="font-medium text-gray-900 mt-2">{msg.subject}</h4>
                          <p className="text-sm text-gray-600 mt-1">To: {msg.to_email}</p>
                          <p className="text-sm text-gray-500 mt-2 line-clamp-2">{msg.message}</p>
                          {msg.error_message && (
                            <div className="mt-2 text-sm text-red-600 bg-red-50 p-2 rounded">
                              Error: {msg.error_message}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t px-6 py-4 flex justify-end bg-gray-50 rounded-b-lg">
          {onClose && (
            <button
              onClick={onClose}
              className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors"
            >
              Close
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default Settings;
