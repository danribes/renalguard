import React, { useState, useEffect } from 'react';

interface Doctor {
  email: string;
  name: string;
  specialty?: string;
  phone?: string;
  smtp_host?: string;
  smtp_port?: number;
  smtp_user?: string;
  smtp_password?: string;
  from_email?: string;
  from_name?: string;
  smtp_enabled?: boolean;
}

interface ExternalEmail {
  id: number;
  email: string;
  name: string;
  description?: string;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

interface Category {
  category: string;
  patient_count: number;
  display_name: string;
}

interface Assignment {
  category: string;
  doctor_email: string;
  doctor_name: string;
}

interface DoctorAssignmentProps {
  apiUrl: string;
  onClose?: () => void;
}

const DoctorAssignmentInterface: React.FC<DoctorAssignmentProps> = ({ apiUrl, onClose }) => {
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [assignments, setAssignments] = useState<{ [key: string]: string }>({});
  const [newDoctorEmail, setNewDoctorEmail] = useState('');
  const [newDoctorName, setNewDoctorName] = useState('');
  const [newDoctorSpecialty, setNewDoctorSpecialty] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [editingDoctor, setEditingDoctor] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Doctor>({ email: '', name: '', specialty: '' });
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [smtpConfigDoctor, setSmtpConfigDoctor] = useState<Doctor | null>(null);
  const [smtpForm, setSmtpForm] = useState({
    smtp_host: '',
    smtp_port: 587,
    smtp_user: '',
    smtp_password: '',
    from_email: '',
    from_name: '',
    smtp_enabled: false
  });
  const [externalEmails, setExternalEmails] = useState<ExternalEmail[]>([]);
  const [newExternalEmail, setNewExternalEmail] = useState('');
  const [newExternalName, setNewExternalName] = useState('');
  const [newExternalDescription, setNewExternalDescription] = useState('');

  useEffect(() => {
    fetchDoctors();
    fetchCategories();
    fetchAssignments();
    fetchExternalEmails();
  }, []);

  // Auto-dismiss success messages after 5 seconds
  useEffect(() => {
    if (message?.type === 'success') {
      const timer = setTimeout(() => {
        setMessage(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [message]);

  const fetchDoctors = async () => {
    try {
      const response = await fetch(`${apiUrl}/api/doctors`);
      const data = await response.json();
      if (data.status === 'success') {
        setDoctors(data.doctors);
      }
    } catch (error) {
      console.error('Failed to fetch doctors:', error);
    }
  };

  const fetchCategories = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${apiUrl}/api/doctors/category-stats`);
      const data = await response.json();
      if (data.status === 'success') {
        setCategories(data.categories);
      }
    } catch (error) {
      console.error('Failed to fetch categories:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAssignments = async () => {
    try {
      const response = await fetch(`${apiUrl}/api/doctors/category-assignments`);
      const data = await response.json();
      if (data.status === 'success') {
        // Convert the response to the assignments format
        const fetchedAssignments: { [key: string]: string } = {};
        Object.entries(data.data).forEach(([category, assignmentData]: [string, any]) => {
          if (assignmentData && assignmentData.email) {
            fetchedAssignments[category] = assignmentData.email;
          }
        });
        setAssignments(fetchedAssignments);
        console.log('Loaded existing assignments:', fetchedAssignments);
      }
    } catch (error) {
      console.error('Failed to fetch assignments:', error);
    }
  };

  const handleAddDoctor = async () => {
    if (!newDoctorEmail || !newDoctorName) {
      setMessage({ type: 'error', text: 'Email and name are required' });
      return;
    }

    try {
      const response = await fetch(`${apiUrl}/api/doctors`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: newDoctorEmail,
          name: newDoctorName,
          specialty: newDoctorSpecialty || 'Nephrology',
        }),
      });

      const data = await response.json();
      if (data.status === 'success') {
        setDoctors([...doctors, data.doctor]);
        setNewDoctorEmail('');
        setNewDoctorName('');
        setNewDoctorSpecialty('');
        setMessage({ type: 'success', text: 'Doctor added successfully!' });
      } else {
        setMessage({ type: 'error', text: data.message || 'Failed to add doctor' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to add doctor' });
    }
  };

  const handleEditDoctor = (doctor: Doctor) => {
    setEditingDoctor(doctor.email);
    setEditForm({ ...doctor });
  };

  const handleCancelEdit = () => {
    setEditingDoctor(null);
    setEditForm({ email: '', name: '', specialty: '' });
  };

  const handleSaveEdit = async () => {
    if (!editForm.name) {
      setMessage({ type: 'error', text: 'Doctor name is required' });
      return;
    }

    try {
      const response = await fetch(`${apiUrl}/api/doctors/${editingDoctor}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editForm.name,
          specialty: editForm.specialty,
        }),
      });

      const data = await response.json();
      if (data.status === 'success') {
        setDoctors(doctors.map(d => d.email === editingDoctor ? data.doctor : d));
        setMessage({ type: 'success', text: 'Doctor updated successfully!' });
        handleCancelEdit();
      } else {
        setMessage({ type: 'error', text: data.message || 'Failed to update doctor' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to update doctor' });
    }
  };

  const handleDeleteDoctor = async (doctorEmail: string, doctorName: string) => {
    if (!confirm(`Are you sure you want to delete ${doctorName}? This will remove all patient assignments for this doctor.`)) {
      return;
    }

    try {
      const response = await fetch(`${apiUrl}/api/doctors/${doctorEmail}`, {
        method: 'DELETE',
      });

      const data = await response.json();
      if (data.status === 'success') {
        setDoctors(doctors.filter(d => d.email !== doctorEmail));
        setMessage({ type: 'success', text: `${doctorName} deleted successfully!` });
        // Clear assignments for this doctor
        const newAssignments = { ...assignments };
        Object.keys(newAssignments).forEach(key => {
          if (newAssignments[key] === doctorEmail) {
            delete newAssignments[key];
          }
        });
        setAssignments(newAssignments);
      } else {
        setMessage({ type: 'error', text: data.message || 'Failed to delete doctor' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to delete doctor' });
    }
  };

  const handleAssignmentChange = (category: string, doctorEmail: string) => {
    const newAssignments = { ...assignments };
    if (doctorEmail) {
      // Assign doctor
      newAssignments[category] = doctorEmail;
    } else {
      // Remove assignment (user selected "Select Doctor...")
      delete newAssignments[category];
    }
    setAssignments(newAssignments);
    setHasUnsavedChanges(true);
    // Clear any existing messages when making changes
    if (message) {
      setMessage(null);
    }
  };

  const handleSaveAssignments = async () => {
    // Build assignment array for ALL categories, including empty assignments (for removal)
    const assignmentArray: Assignment[] = categories.map((cat) => {
      const doctorEmail = assignments[cat.category] || '';
      const doctor = doctorEmail ? doctors.find(d => d.email === doctorEmail) : null;
      return {
        category: cat.category,
        doctor_email: doctorEmail,
        doctor_name: doctor?.name || '',
      };
    });

    try {
      setSaving(true);
      const response = await fetch(`${apiUrl}/api/doctors/assign-by-category`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assignments: assignmentArray }),
      });

      const data = await response.json();
      if (data.status === 'success') {
        const totalAssigned = data.results.reduce(
          (sum: number, r: any) => sum + (r.patients_assigned || 0),
          0
        );
        const totalUnassigned = data.results.reduce(
          (sum: number, r: any) => sum + (r.patients_unassigned || 0),
          0
        );

        let message = '';
        if (totalAssigned > 0 && totalUnassigned > 0) {
          message = `Assigned ${totalAssigned} patients and unassigned ${totalUnassigned} patients!`;
        } else if (totalAssigned > 0) {
          message = `Successfully assigned ${totalAssigned} patients!`;
        } else if (totalUnassigned > 0) {
          message = `Successfully unassigned ${totalUnassigned} patients!`;
        } else {
          message = 'No changes made to assignments.';
        }

        setMessage({
          type: 'success',
          text: message,
        });
        setHasUnsavedChanges(false);
        // Reload assignments to show the updated selections
        await fetchAssignments();
      } else {
        setMessage({ type: 'error', text: data.message || 'Failed to save assignments' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to save assignments' });
    } finally {
      setSaving(false);
    }
  };

  const handleOpenSmtpConfig = (doctor: Doctor) => {
    setSmtpConfigDoctor(doctor);
    setSmtpForm({
      smtp_host: doctor.smtp_host || '',
      smtp_port: doctor.smtp_port || 587,
      smtp_user: doctor.smtp_user || '',
      smtp_password: doctor.smtp_password || '',
      from_email: doctor.from_email || doctor.email,
      from_name: doctor.from_name || doctor.name,
      smtp_enabled: doctor.smtp_enabled || false
    });
  };

  const handleCloseSmtpConfig = () => {
    setSmtpConfigDoctor(null);
  };

  const handleSaveSmtpConfig = async () => {
    if (!smtpConfigDoctor) return;

    try {
      const response = await fetch(`${apiUrl}/api/doctors/${smtpConfigDoctor.email}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(smtpForm),
      });

      const data = await response.json();
      if (data.status === 'success') {
        setDoctors(doctors.map(d => d.email === smtpConfigDoctor.email ? data.doctor : d));
        setMessage({ type: 'success', text: 'SMTP settings saved successfully!' });
        handleCloseSmtpConfig();
      } else {
        setMessage({ type: 'error', text: data.message || 'Failed to save SMTP settings' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to save SMTP settings' });
    }
  };

  const fetchExternalEmails = async () => {
    try {
      const response = await fetch(`${apiUrl}/api/doctors/external-notifications`);
      const data = await response.json();
      if (data.status === 'success') {
        setExternalEmails(data.emails);
      }
    } catch (error) {
      console.error('Failed to fetch external emails:', error);
    }
  };

  const handleAddExternalEmail = async () => {
    if (!newExternalEmail || !newExternalName) {
      setMessage({ type: 'error', text: 'Email and name are required' });
      return;
    }

    try {
      const response = await fetch(`${apiUrl}/api/doctors/external-notifications`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: newExternalEmail,
          name: newExternalName,
          description: newExternalDescription || null,
        }),
      });

      const data = await response.json();
      if (data.status === 'success') {
        setExternalEmails([...externalEmails, data.email]);
        setNewExternalEmail('');
        setNewExternalName('');
        setNewExternalDescription('');
        setMessage({ type: 'success', text: 'External notification email added successfully!' });
      } else {
        setMessage({ type: 'error', text: data.message || 'Failed to add external email' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to add external email' });
    }
  };

  const handleToggleExternalEmail = async (id: number, enabled: boolean) => {
    try {
      const response = await fetch(`${apiUrl}/api/doctors/external-notifications/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled }),
      });

      const data = await response.json();
      if (data.status === 'success') {
        setExternalEmails(externalEmails.map(e => e.id === id ? data.email : e));
        setMessage({ type: 'success', text: `Email ${enabled ? 'enabled' : 'disabled'} successfully!` });
      } else {
        setMessage({ type: 'error', text: data.message || 'Failed to update email' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to update email' });
    }
  };

  const handleDeleteExternalEmail = async (id: number, email: string) => {
    if (!confirm(`Are you sure you want to delete ${email}? They will no longer receive notifications.`)) {
      return;
    }

    try {
      const response = await fetch(`${apiUrl}/api/doctors/external-notifications/${id}`, {
        method: 'DELETE',
      });

      const data = await response.json();
      if (data.status === 'success') {
        setExternalEmails(externalEmails.filter(e => e.id !== id));
        setMessage({ type: 'success', text: `${email} deleted successfully!` });
      } else {
        setMessage({ type: 'error', text: data.message || 'Failed to delete email' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to delete email' });
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] overflow-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold text-gray-800">Doctor Assignment by Category</h2>
            <p className="text-sm text-gray-600 mt-1">Assign doctors to patient categories for automated alert routing</p>
          </div>
          {onClose && (
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        <div className="p-6">
          {/* Message */}
          {message && (
            <div
              className={`mb-4 p-4 rounded-lg flex items-start justify-between ${
                message.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'
              }`}
            >
              <div className="flex items-start">
                {message.type === 'success' ? (
                  <svg className="w-5 h-5 mr-2 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5 mr-2 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                )}
                <span>{message.text}</span>
              </div>
              <button
                onClick={() => setMessage(null)}
                className="ml-4 text-gray-500 hover:text-gray-700 flex-shrink-0"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          )}

          {/* Add Doctor Section */}
          <div className="mb-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Add New Doctor</h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <input
                type="email"
                placeholder="Email *"
                value={newDoctorEmail}
                onChange={(e) => setNewDoctorEmail(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <input
                type="text"
                placeholder="Full Name *"
                value={newDoctorName}
                onChange={(e) => setNewDoctorName(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <input
                type="text"
                placeholder="Specialty (optional)"
                value={newDoctorSpecialty}
                onChange={(e) => setNewDoctorSpecialty(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <button
                onClick={handleAddDoctor}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors"
              >
                Add Doctor
              </button>
            </div>
          </div>

          {/* External Notification Emails Section */}
          <div className="mb-8 bg-green-50 border border-green-200 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-2">
              ➕ External Notification Emails
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              Add external email addresses that will receive ALL system alerts (not assigned to specific categories)
            </p>

            {/* Add External Email Form */}
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-4">
              <input
                type="email"
                placeholder="Email *"
                value={newExternalEmail}
                onChange={(e) => setNewExternalEmail(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
              <input
                type="text"
                placeholder="Name *"
                value={newExternalName}
                onChange={(e) => setNewExternalName(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
              <input
                type="text"
                placeholder="Description (optional)"
                value={newExternalDescription}
                onChange={(e) => setNewExternalDescription(e.target.value)}
                className="md:col-span-2 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
              <button
                onClick={handleAddExternalEmail}
                className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium transition-colors"
              >
                Add Email
              </button>
            </div>

            {/* External Emails List */}
            {externalEmails.length > 0 && (
              <div className="space-y-2">
                {externalEmails.map((email) => (
                  <div
                    key={email.id}
                    className={`flex items-center justify-between p-3 rounded-lg border ${
                      email.enabled
                        ? 'bg-white border-green-300'
                        : 'bg-gray-100 border-gray-300 opacity-60'
                    }`}
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-800">{email.name}</span>
                        {!email.enabled && (
                          <span className="text-xs text-gray-500">(Disabled)</span>
                        )}
                      </div>
                      <div className="text-sm text-gray-600">{email.email}</div>
                      {email.description && (
                        <div className="text-xs text-gray-500 mt-1">{email.description}</div>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleToggleExternalEmail(email.id, !email.enabled)}
                        className={`px-3 py-1 text-sm rounded ${
                          email.enabled
                            ? 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                            : 'bg-green-600 text-white hover:bg-green-700'
                        } transition-colors`}
                      >
                        {email.enabled ? 'Disable' : 'Enable'}
                      </button>
                      <button
                        onClick={() => handleDeleteExternalEmail(email.id, email.email)}
                        className="px-3 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {externalEmails.length === 0 && (
              <p className="text-gray-500 text-center py-4 text-sm">
                No external notification emails configured yet
              </p>
            )}
          </div>

          {/* Existing Doctors */}
          <div className="mb-8">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">
              Available Doctors ({doctors.length})
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {doctors.map((doctor) => (
                <div key={doctor.email} className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                  {editingDoctor === doctor.email ? (
                    // Edit mode
                    <div className="space-y-3">
                      <input
                        type="text"
                        value={editForm.name}
                        onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Doctor name"
                      />
                      <input
                        type="text"
                        value={editForm.specialty || ''}
                        onChange={(e) => setEditForm({ ...editForm, specialty: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Specialty"
                      />
                      <div className="text-xs text-gray-500 break-all">{doctor.email}</div>
                      <div className="flex gap-2">
                        <button
                          onClick={handleSaveEdit}
                          className="flex-1 px-3 py-1.5 bg-green-600 text-white text-sm rounded hover:bg-green-700"
                        >
                          Save
                        </button>
                        <button
                          onClick={handleCancelEdit}
                          className="flex-1 px-3 py-1.5 bg-gray-400 text-white text-sm rounded hover:bg-gray-500"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    // View mode
                    <>
                      <div className="font-medium text-gray-800">{doctor.name}</div>
                      <div className="text-sm text-gray-600 break-all">{doctor.email}</div>
                      {doctor.specialty && (
                        <div className="text-xs text-gray-500 mt-1">{doctor.specialty}</div>
                      )}
                      {doctor.smtp_enabled && (
                        <div className="text-xs text-green-600 mt-1">✓ SMTP Configured</div>
                      )}
                      <div className="flex flex-col gap-2 mt-3">
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleEditDoctor(doctor)}
                            className="flex-1 px-3 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition-colors"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDeleteDoctor(doctor.email, doctor.name)}
                            className="flex-1 px-3 py-1.5 bg-red-600 text-white text-sm rounded hover:bg-red-700 transition-colors"
                          >
                            Delete
                          </button>
                        </div>
                        <button
                          onClick={() => handleOpenSmtpConfig(doctor)}
                          className="w-full px-3 py-1.5 bg-purple-600 text-white text-sm rounded hover:bg-purple-700 transition-colors"
                        >
                          📧 SMTP Settings
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
            {doctors.length === 0 && (
              <p className="text-gray-500 text-center py-8">No doctors added yet. Add your first doctor above.</p>
            )}
          </div>

          {/* Category Assignments */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Assign Doctors to Categories</h3>

            {loading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                <p className="text-gray-600 mt-4">Loading categories...</p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Non-CKD Categories */}
                <div className="border border-gray-200 rounded-lg p-4">
                  <h4 className="font-semibold text-gray-700 mb-3">Non-CKD Patients</h4>
                  <div className="space-y-3">
                    {categories
                      .filter(cat => cat.category.startsWith('non_ckd'))
                      .map((cat) => {
                        const assignedDoctor = doctors.find(d => d.email === assignments[cat.category]);
                        return (
                          <div key={cat.category} className="bg-gray-50 p-3 rounded">
                            <div className="flex items-center justify-between">
                              <div className="flex-1">
                                <div className="font-medium text-gray-800">{cat.display_name}</div>
                                <div className="text-sm text-gray-600">{cat.patient_count} patients</div>
                              </div>
                              <select
                                value={assignments[cat.category] || ''}
                                onChange={(e) => handleAssignmentChange(cat.category, e.target.value)}
                                className={`px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent min-w-[250px] ${
                                  assignedDoctor
                                    ? 'border-green-500 bg-green-50'
                                    : 'border-gray-300 bg-white'
                                }`}
                              >
                                <option value="">Select Doctor...</option>
                                {doctors.map((doctor) => (
                                  <option key={doctor.email} value={doctor.email}>
                                    {doctor.name}
                                  </option>
                                ))}
                              </select>
                            </div>
                            {assignedDoctor && (
                              <div className="mt-2 flex items-center text-sm text-green-700 bg-green-100 px-3 py-2 rounded">
                                <svg className="w-4 h-4 mr-2 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                </svg>
                                <span className="font-medium">Assigned to: {assignedDoctor.name}</span>
                                {assignedDoctor.specialty && (
                                  <span className="ml-2 text-green-600">({assignedDoctor.specialty})</span>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                  </div>
                </div>

                {/* CKD Categories */}
                <div className="border border-orange-200 rounded-lg p-4 bg-orange-50">
                  <h4 className="font-semibold text-gray-700 mb-3">CKD Patients</h4>
                  <div className="space-y-3">
                    {categories
                      .filter(cat => cat.category.startsWith('ckd'))
                      .map((cat) => {
                        const assignedDoctor = doctors.find(d => d.email === assignments[cat.category]);
                        return (
                          <div key={cat.category} className="bg-white p-3 rounded">
                            <div className="flex items-center justify-between">
                              <div className="flex-1">
                                <div className="font-medium text-gray-800">{cat.display_name}</div>
                                <div className="text-sm text-gray-600">{cat.patient_count} patients</div>
                              </div>
                              <select
                                value={assignments[cat.category] || ''}
                                onChange={(e) => handleAssignmentChange(cat.category, e.target.value)}
                                className={`px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent min-w-[250px] ${
                                  assignedDoctor
                                    ? 'border-green-500 bg-green-50'
                                    : 'border-gray-300 bg-white'
                                }`}
                              >
                                <option value="">Select Doctor...</option>
                                {doctors.map((doctor) => (
                                  <option key={doctor.email} value={doctor.email}>
                                    {doctor.name}
                                  </option>
                                ))}
                              </select>
                            </div>
                            {assignedDoctor && (
                              <div className="mt-2 flex items-center text-sm text-green-700 bg-green-100 px-3 py-2 rounded">
                                <svg className="w-4 h-4 mr-2 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                </svg>
                                <span className="font-medium">Assigned to: {assignedDoctor.name}</span>
                                {assignedDoctor.specialty && (
                                  <span className="ml-2 text-green-600">({assignedDoctor.specialty})</span>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end space-x-4 pt-4 border-t">
            {onClose && (
              <button
                onClick={onClose}
                className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium transition-colors"
              >
                Cancel
              </button>
            )}
            <button
              onClick={handleSaveAssignments}
              disabled={saving || doctors.length === 0 || !hasUnsavedChanges}
              className={`px-6 py-2 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center ${
                hasUnsavedChanges ? 'bg-green-600 hover:bg-green-700' : 'bg-gray-400'
              }`}
            >
              {saving ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Saving...
                </>
              ) : hasUnsavedChanges ? (
                <>
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Save Assignments
                </>
              ) : (
                <>
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  All Saved
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* SMTP Configuration Modal */}
      {smtpConfigDoctor && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60]">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-auto m-4">
            <div className="border-b px-6 py-4">
              <h3 className="text-xl font-bold text-gray-800">
                SMTP Settings for {smtpConfigDoctor.name}
              </h3>
              <p className="text-sm text-gray-600 mt-1">
                Configure email server settings for this doctor
              </p>
            </div>

            <div className="p-6 space-y-4">
              {/* Enable SMTP Toggle */}
              <div className="flex items-center space-x-3 p-4 bg-gray-50 rounded-lg">
                <input
                  type="checkbox"
                  id="smtp_enabled"
                  checked={smtpForm.smtp_enabled}
                  onChange={(e) => setSmtpForm({ ...smtpForm, smtp_enabled: e.target.checked })}
                  className="w-5 h-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                />
                <label htmlFor="smtp_enabled" className="flex-1 cursor-pointer">
                  <div className="font-medium text-gray-800">Enable Custom SMTP</div>
                  <div className="text-sm text-gray-600">
                    Use custom email server for this doctor's notifications
                  </div>
                </label>
              </div>

              {smtpForm.smtp_enabled && (
                <>
                  {/* SMTP Host */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      SMTP Host *
                    </label>
                    <input
                      type="text"
                      value={smtpForm.smtp_host}
                      onChange={(e) => setSmtpForm({ ...smtpForm, smtp_host: e.target.value })}
                      placeholder="smtp.gmail.com"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  {/* SMTP Port */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      SMTP Port *
                    </label>
                    <input
                      type="number"
                      value={smtpForm.smtp_port}
                      onChange={(e) => setSmtpForm({ ...smtpForm, smtp_port: parseInt(e.target.value) })}
                      placeholder="587"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  {/* SMTP User */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      SMTP Username *
                    </label>
                    <input
                      type="text"
                      value={smtpForm.smtp_user}
                      onChange={(e) => setSmtpForm({ ...smtpForm, smtp_user: e.target.value })}
                      placeholder="your-email@gmail.com"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  {/* SMTP Password */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      SMTP Password/App Password *
                    </label>
                    <input
                      type="password"
                      value={smtpForm.smtp_password}
                      onChange={(e) => setSmtpForm({ ...smtpForm, smtp_password: e.target.value })}
                      placeholder="Your app password"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      For Gmail, create an App Password in your Google Account settings
                    </p>
                  </div>

                  {/* From Email */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      From Email
                    </label>
                    <input
                      type="email"
                      value={smtpForm.from_email}
                      onChange={(e) => setSmtpForm({ ...smtpForm, from_email: e.target.value })}
                      placeholder={smtpConfigDoctor.email}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  {/* From Name */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      From Name
                    </label>
                    <input
                      type="text"
                      value={smtpForm.from_name}
                      onChange={(e) => setSmtpForm({ ...smtpForm, from_name: e.target.value })}
                      placeholder={smtpConfigDoctor.name}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </>
              )}
            </div>

            <div className="border-t px-6 py-4 flex justify-end space-x-3">
              <button
                onClick={handleCloseSmtpConfig}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveSmtpConfig}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
              >
                Save SMTP Settings
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DoctorAssignmentInterface;
