import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import '../../design/Dashboard.css';
import API_URL from '../../server/config/api';

function Dashboard() {
  const [user, setUser] = useState(null);
  const [students, setStudents] = useState([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newStudent, setNewStudent] = useState({
    username: '',
    email: '',
    password: '',
    grade: 'Grade 10'
  });
  const [loading, setLoading] = useState(false);

  // Report states
  const [reportType, setReportType] = useState('daily');
  const [reportData, setReportData] = useState({
    students: [],
    stats: { total: 0, present: 0, absent: 0, late: 0 },
    period: '',
    generatedAt: ''
  });
  const [showReport, setShowReport] = useState(false);
  const reportRef = useRef();

  useEffect(() => {
    // Get user data from localStorage
    const userData = localStorage.getItem('user');
    if (userData) {
      setUser(JSON.parse(userData));
    }
    fetchStudents();
  }, []);

  const fetchStudents = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        alert('No token found. Please login again.');
        handleLogout();
        return;
      }

      const response = await axios.get(`${API_URL}/api/students`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.data.success) {
        setStudents(response.data.data);
      }
    } catch (error) {
      console.error('Error fetching students:', error);
      if (error.response?.status === 401 || error.response?.status === 403) {
        alert('Session expired. Please login again.');
        handleLogout();
      }
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/';
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setNewStudent(prev => ({ ...prev, [name]: value }));
  };

  const handleAddStudent = async (e) => {
    e.preventDefault();

    if (!newStudent.username?.trim() || !newStudent.email?.trim() || !newStudent.password?.trim()) {
      alert('Please fill all fields');
      return;
    }

    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(
        `${API_URL}/api/students`,
        newStudent,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.data.success) {
        alert(`Student ${response.data.data.username} added successfully!`);
        setNewStudent({ username: '', email: '', password: '', grade: 'Grade 10' });
        setShowAddForm(false);
        fetchStudents();
      }
    } catch (error) {
      const msg = error.response?.data?.message || 'Failed to add student';
      alert(msg);
      
      if (error.response?.status === 401 || error.response?.status === 403) {
        alert('Session expired. Please login again.');
        handleLogout();
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteStudent = async (id) => {
    const student = students.find(s => s._id === id);
    const studentName = student?.username || 'this student';

    if (window.confirm(`Are you sure you want to delete ${studentName}?`)) {
      try {
        const token = localStorage.getItem('token');
        const response = await axios.delete(`${API_URL}/api/students/${id}`, {
          headers: { Authorization: `Bearer ${token}` }
        });

        if (response.data.success) {
          alert('Student deleted successfully!');
          fetchStudents();
        }
      } catch (error) {
        alert(error.response?.data?.message || 'Failed to delete student');
        
        if (error.response?.status === 401 || error.response?.status === 403) {
          alert('Session expired. Please login again.');
          handleLogout();
        }
      }
    }
  };

  // UPDATED: Mark attendance for today (saves to database)
  const handleAttendance = async (studentId, status) => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(
        `${API_URL}/api/students/${studentId}/attendance`,
        { status },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.data.success) {
        alert(`✅ Attendance marked as "${status.toUpperCase()}" for today!`);
        // Refresh students to show updated attendance
        fetchStudents();
      }
    } catch (error) {
      console.error('Attendance error:', error);
      
      if (error.response?.status === 401 || error.response?.status === 403) {
        alert('Session expired. Please login again.');
        handleLogout();
      } else {
        alert(error.response?.data?.message || 'Failed to save attendance');
      }
    }
  };

  const getAttendanceStats = () => {
    const present = students.filter(s => s.attendance === 'present').length;
    const absent = students.filter(s => s.attendance === 'absent').length;
    const late = students.filter(s => s.attendance === 'late').length;
    const notMarked = students.filter(s => !s.attendance).length;

    return { present, absent, late, notMarked };
  };

  const generateReport = async () => {
    if (students.length === 0) {
      alert('No students found. Add students first!');
      return;
    }

    const studentsWithAttendance = students.filter(s => s.attendance);

    if (studentsWithAttendance.length === 0) {
      alert('No attendance marked yet. Mark attendance for students first!');
      return;
    }

    const now = new Date();
    const stats = {
      total: students.length,
      present: studentsWithAttendance.filter(s => s.attendance === 'present').length,
      absent: studentsWithAttendance.filter(s => s.attendance === 'absent').length,
      late: studentsWithAttendance.filter(s => s.attendance === 'late').length
    };

    const reportStudents = studentsWithAttendance.map(student => ({
      id: student._id,
      username: student.username,
      email: student.email,
      attendance: student.attendance,
      markedOn: student.attendanceUpdatedAt || now
    }));

    const finalReportData = {
      stats,
      students: reportStudents,
      period: reportType.charAt(0).toUpperCase() + reportType.slice(1),
      generatedAt: now.toLocaleString()
    };

    setReportData(finalReportData);
    setShowReport(true);
  };

  const generatePDF = async () => {
    try {
      const jsPDF = (await import('jspdf')).default;
      const html2canvas = (await import('html2canvas')).default;

      const element = reportRef.current;
      const canvas = await html2canvas(element, {
        scale: 1.5,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff'
      });

      const imgData = canvas.toDataURL('image/png', 1.0);
      const pdf = new jsPDF('p', 'mm', 'a4');
      
      const pdfWidth = 210;
      const pdfHeight = 297;
      const imgWidth = pdfWidth - 20;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      pdf.addImage(imgData, 'PNG', 10, 10, imgWidth, imgHeight);
      
      const filename = `attendance-report-${reportType}-${new Date().toISOString().split('T')[0]}.pdf`;
      pdf.save(filename);
      
      console.log('PDF generated:', filename);
    } catch (error) {
      console.error('PDF generation failed:', error);
      alert('Failed to generate PDF. Please try again.');
    }
  };

  const stats = getAttendanceStats();

  if (!user) {
    return <div>Loading...</div>;
  }

  return (
    <div className="dashboard-container">
      <div className="dashboard-header">
        <h1>Student Management System</h1>
        <button onClick={handleLogout} className="logout-btn">Logout</button>
      </div>

      <div className="dashboard-content">
        <div className="welcome-section">
          <h2>Hi, {user.name}! 👋</h2>
          <p>Manage your students and track daily attendance</p>
        </div>

        {/* Attendance Stats - TODAY'S DATA */}
        <div className="attendance-stats">
          <div className="stat-box present-box">
            <h3>{stats.present}</h3>
            <p>Present</p>
          </div>
          <div className="stat-box absent-box">
            <h3>{stats.absent}</h3>
            <p>Absent</p>
          </div>
          <div className="stat-box late-box">
            <h3>{stats.late}</h3>
            <p>Late</p>
          </div>
          <div className="stat-box unmarked-box">
            <h3>{stats.notMarked}</h3>
            <p>Not Marked</p>
          </div>
        </div>

        {/* Reports Section */}
        <div className="reports-section">
          <h3>📊 Attendance Reports</h3>
          <div className="report-controls">
            <div className="form-group">
              <label>Report Period</label>
              <select 
                value={reportType} 
                onChange={(e) => setReportType(e.target.value)}
                className="form-select"
              >
                <option value="daily">Daily Report</option>
                <option value="weekly">Weekly Report</option>
                <option value="monthly">Monthly Report</option>
              </select>
            </div>
            <button onClick={generateReport} className="add-student-btn">
              Generate Report
            </button>
          </div>
        </div>

        {/* Report Preview */}
        {showReport && reportData.students.length > 0 && (
          <div className="report-view" ref={reportRef}>
            <div className="report-header">
              <h4>{reportData.period} Attendance Report</h4>
              <p>Generated: {reportData.generatedAt}</p>
            </div>

            <div className="report-stats">
              <div className="stat-box">
                <h3>{reportData.stats.total}</h3>
                <p>Total Students</p>
              </div>
              <div className="stat-box present-box">
                <h3>{reportData.stats.present}</h3>
                <p>Present</p>
              </div>
              <div className="stat-box absent-box">
                <h3>{reportData.stats.absent}</h3>
                <p>Absent</p>
              </div>
              <div className="stat-box late-box">
                <h3>{reportData.stats.late}</h3>
                <p>Late</p>
              </div>
            </div>

            <div className="report-table-container">
              <table className="report-table">
                <thead>
                  <tr>
                    <th>Username</th>
                    <th>Email</th>
                    <th>Status</th>
                    <th>Marked On</th>
                  </tr>
                </thead>
                <tbody>
                  {reportData.students.map(student => (
                    <tr key={student.id}>
                      <td>{student.username}</td>
                      <td>{student.email}</td>
                      <td className={`status-${student.attendance}`}>
                        {student.attendance.toUpperCase()}
                      </td>
                      <td>
                        {new Date(student.markedOn).toLocaleString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                          hour: 'numeric',
                          minute: '2-digit',
                          hour12: true
                        })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="report-actions">
              <button onClick={generatePDF} className="submit-btn">
                Download PDF Report
              </button>
              <button 
                onClick={() => setShowReport(false)} 
                className="logout-btn" 
                style={{ marginLeft: '1rem' }}
              >
                Close Report
              </button>
            </div>
          </div>
        )}

        {/* Add Student Section */}
        <div className="actions-section">
          <button 
            onClick={() => setShowAddForm(!showAddForm)} 
            className="add-student-btn"
          >
            {showAddForm ? 'Cancel' : '+ Add Student'}
          </button>
        </div>

        {showAddForm && (
          <div className="add-student-form">
            <h3>Add New Student</h3>
            <form onSubmit={handleAddStudent}>
              <div className="form-row">
                <div className="form-group">
                  <label>Username</label>
                  <input
                    type="text"
                    name="username"
                    value={newStudent.username}
                    onChange={handleInputChange}
                    placeholder="Enter username"
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Email</label>
                  <input
                    type="email"
                    name="email"
                    value={newStudent.email}
                    onChange={handleInputChange}
                    placeholder="Enter email"
                    required
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Password</label>
                  <input
                    type="password"
                    name="password"
                    value={newStudent.password}
                    onChange={handleInputChange}
                    placeholder="Enter password"
                    minLength="6"
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Grade</label>
                  <select
                    name="grade"
                    value={newStudent.grade}
                    onChange={handleInputChange}
                    className="form-select"
                  >
                    <option value="Grade 7">Grade 7</option>
                    <option value="Grade 8">Grade 8</option>
                    <option value="Grade 9">Grade 9</option>
                    <option value="Grade 10">Grade 10</option>
                    <option value="Grade 11">Grade 11</option>
                    <option value="Grade 12">Grade 12</option>
                  </select>
                </div>
              </div>

              <button type="submit" className="submit-btn" disabled={loading}>
                {loading ? 'Adding...' : 'Add Student'}
              </button>
            </form>
          </div>
        )}

        {/* Students List */}
        <div className="students-list">
          <h3>Students ({students.length})</h3>
          {students.length === 0 ? (
            <div className="empty-state">
              <p>No students yet. Click "Add Student" to get started!</p>
            </div>
          ) : (
            <div className="students-grid">
              {students.map(student => (
                <div 
                  key={student._id} 
                  className={`student-card ${student.attendance || ''}`}
                >
                  <div className="student-info">
                    <h4>👤 {student.username}</h4>
                    <p>📧 {student.email}</p>
                    <p>📚 {student.grade}</p>
                    <p className="date-added">
                      Added: {new Date(student.createdAt).toLocaleDateString()}
                    </p>
                    {student.attendanceUpdatedAt && (
                      <p className="attendance-date">
                        Last marked: {new Date(student.attendanceUpdatedAt).toLocaleString()}
                      </p>
                    )}
                  </div>

                  <div className="attendance-section">
                    <p className="attendance-label">Mark Today's Attendance:</p>
                    <div className="attendance-buttons">
                      <button
                        className={`att-btn present ${student.attendance === 'present' ? 'active' : ''}`}
                        onClick={() => handleAttendance(student._id, 'present')}
                      >
                        ✓ Present
                      </button>
                      <button
                        className={`att-btn absent ${student.attendance === 'absent' ? 'active' : ''}`}
                        onClick={() => handleAttendance(student._id, 'absent')}
                      >
                        ✗ Absent
                      </button>
                      <button
                        className={`att-btn late ${student.attendance === 'late' ? 'active' : ''}`}
                        onClick={() => handleAttendance(student._id, 'late')}
                      >
                        ⏰ Late
                      </button>
                    </div>
                  </div>

                  <button
                    onClick={() => handleDeleteStudent(student._id)}
                    className="delete-btn"
                  >
                    🗑️ Delete
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
