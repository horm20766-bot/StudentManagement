
"use strict";

/* ==========================================
   STUDENTHUB
   Cloudflare D1 + Authentication + Telegram
========================================== */

const API_URL =
    "https://misty-sun-17d3studenthub-api.horm20766.workers.dev";

const TELEGRAM_WORKER_URL =
    "https://student-telegram-api.horm20766.workers.dev";

const LOGIN_URL = "login.html";
const TOKEN_KEY = "studenthub_token";
const USER_KEY = "studenthub_user";

/* ==========================================
   AUTHENTICATION
========================================== */

function getToken() {
    return sessionStorage.getItem(TOKEN_KEY);
}

function getCurrentUser() {
    try {
        return JSON.parse(
            sessionStorage.getItem(USER_KEY) || "null"
        );
    } catch {
        return null;
    }
}

function isAdmin() {
    return getCurrentUser()?.role === "admin";
}

function clearAuth() {
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(USER_KEY);
}

function redirectToLogin() {
    clearAuth();
    window.location.replace(LOGIN_URL);
}

const authToken = getToken();
const currentUser = getCurrentUser();

if (!authToken || !currentUser) {
    redirectToLogin();
}

/* ==========================================
   DOM ELEMENTS
========================================== */

const form = document.getElementById("studentForm");
const studentIdInput = document.getElementById("studentId");
const nameInput = document.getElementById("name");
const ageInput = document.getElementById("age");
const majorInput = document.getElementById("major");
const submitBtn = document.getElementById("submitBtn");

const studentList = document.getElementById("studentList");
const searchInput = document.getElementById("search");
const count = document.getElementById("count");
const message = document.getElementById("message");

const formDisclosure =
    document.getElementById("studentFormSection");

const formSummary =
    document.getElementById("formSummary");

const cancelEditBtn =
    document.getElementById("cancelEditBtn");

const totalStudentsEl =
    document.getElementById("totalStudents");

const totalMajorsEl =
    document.getElementById("totalMajors");

const averageAgeEl =
    document.getElementById("averageAge");

const searchResultsEl =
    document.getElementById("searchResults");

const majorChart =
    document.getElementById("majorChart");

const sidebar = document.getElementById("sidebar");
const menuToggle = document.getElementById("menuToggle");
const sidebarOverlay =
    document.getElementById("sidebarOverlay");

/* ==========================================
   STATE
========================================== */

let students = [];
let databaseReady = false;
let editingStudentId = null;

/* ==========================================
   USER INTERFACE
========================================== */

function setupAuthUI() {
    const user = getCurrentUser();

    const usernameEl =
        document.getElementById("currentUsername");

    const roleEl =
        document.getElementById("currentUserRole");

    const logoutBtn =
        document.getElementById("logoutBtn");

    if (usernameEl) {
        usernameEl.textContent = user?.username || "User";
    }

    if (roleEl) {
        roleEl.textContent =
            user?.role === "admin" ? "Admin" : "User";
    }

    if (logoutBtn) {
        logoutBtn.addEventListener("click", async () => {
            logoutBtn.disabled = true;

            try {
                if (getToken()) {
                    await apiRequest("/auth/logout", {
                        method: "POST"
                    });
                }
            } catch (error) {
                console.warn("Logout request failed:", error);
            } finally {
                clearAuth();
                window.location.replace(LOGIN_URL);
            }
        });
    }

    if (!isAdmin()) {
        if (formDisclosure) formDisclosure.hidden = true;
        if (form) form.hidden = true;
        if (cancelEditBtn) cancelEditBtn.hidden = true;
    }

    document.querySelectorAll("[data-admin-only]")
        .forEach(element => {
            element.hidden = !isAdmin();
        });
}

/* ==========================================
   API HELPER
========================================== */

async function apiRequest(path, options = {}) {
    const headers = {
        "Content-Type": "application/json",
        ...(options.headers || {})
    };

    const token = getToken();

    if (token) {
        headers.Authorization = `Bearer ${token}`;
    }

    const response = await fetch(`${API_URL}${path}`, {
        ...options,
        headers
    });

    let result;

    try {
        result = await response.json();
    } catch {
        throw new Error(
            `Invalid API response (HTTP ${response.status}).`
        );
    }

    if (response.status === 401) {
        clearAuth();
        window.location.replace(LOGIN_URL);

        throw new Error(
            "Your session expired. Please log in again."
        );
    }

    if (!response.ok || result.success !== true) {
        throw new Error(
            result.error ||
            result.message ||
            `Request failed (HTTP ${response.status}).`
        );
    }

    return result;
}

/* ==========================================
   SHOW MESSAGE
========================================== */

function showMessage(text, type = "info") {
    if (!message) return;

    message.textContent = text;
    message.dataset.type = type;
}

/* ==========================================
   LOAD STUDENTS FROM CLOUDFLARE D1
========================================== */

async function loadStudents() {
    if (studentList) {
        studentList.replaceChildren();

        const row = document.createElement("tr");
        const cell = document.createElement("td");

        cell.colSpan = 5;
        cell.textContent = "Loading students...";

        row.appendChild(cell);
        studentList.appendChild(row);
    }

    try {
        const result = await apiRequest("/students");

        if (!Array.isArray(result.students)) {
            throw new Error("Invalid student list.");
        }

        students = result.students;
        databaseReady = true;

        displayStudents(searchInput ? searchInput.value : "");

        showMessage("Online database connected.", "success");
    } catch (error) {
        console.error("Could not load students:", error);

        databaseReady = false;
        students = [];

        displayStudents(searchInput ? searchInput.value : "");

        showMessage(
            `Could not load students: ${error.message}`,
            "error"
        );
    }
}

/* ==========================================
   DASHBOARD STATISTICS
========================================== */

function updateDashboard() {
    const total = students.length;

    const uniqueMajors = new Set(
        students
            .map(student =>
                String(student.major || "")
                    .trim()
                    .toLowerCase()
            )
            .filter(Boolean)
    );

    const validAges = students
        .map(student => Number(student.age))
        .filter(age =>
            Number.isFinite(age) &&
            age >= 1 &&
            age <= 120
        );

    const averageAge = validAges.length
        ? Math.round(
            validAges.reduce((sum, age) => sum + age, 0) /
            validAges.length
        )
        : 0;

    if (totalStudentsEl) {
        totalStudentsEl.textContent = total.toLocaleString();
    }

    if (totalMajorsEl) {
        totalMajorsEl.textContent =
            uniqueMajors.size.toLocaleString();
    }

    if (averageAgeEl) {
        averageAgeEl.textContent = averageAge.toLocaleString();
    }

    updateMajorChart();
}

/* ==========================================
   STUDENTS BY MAJOR CHART
========================================== */

function updateMajorChart() {
    if (!majorChart) return;

    majorChart.replaceChildren();

    const majorCounts = new Map();

    students.forEach(student => {
        const major = String(student.major || "").trim();

        if (!major) return;

        const key = major.toLowerCase();

        if (!majorCounts.has(key)) {
            majorCounts.set(key, {
                name: major,
                total: 0
            });
        }

        majorCounts.get(key).total++;
    });

    const sortedMajors = [...majorCounts.values()]
        .sort((a, b) => b.total - a.total)
        .slice(0, 6);

    if (sortedMajors.length === 0) {
        const empty = document.createElement("p");

        empty.className = "empty-chart";
        empty.textContent =
            "Add students to see statistics by major.";

        majorChart.appendChild(empty);
        return;
    }

    const maxCount = Math.max(
        ...sortedMajors.map(item => item.total)
    );

    sortedMajors.forEach(item => {
        const row = document.createElement("div");
        row.className = "chart-row";

        const label = document.createElement("span");
        label.className = "chart-label";
        label.textContent = item.name;
        label.title = item.name;

        const track = document.createElement("div");
        track.className = "chart-track";

        const fill = document.createElement("div");
        fill.className = "chart-fill";

        fill.style.width =
            `${(item.total / maxCount) * 100}%`;

        track.appendChild(fill);

        const value = document.createElement("span");
        value.className = "chart-value";
        value.textContent = String(item.total);

        row.append(label, track, value);
        majorChart.appendChild(row);
    });
}

/* ==========================================
   DISPLAY STUDENTS
========================================== */

function displayStudents(keyword = "") {
    if (!studentList) {
        updateDashboard();
        return;
    }

    studentList.replaceChildren();

    const searchTerm = String(keyword)
        .trim()
        .toLowerCase();

    const filteredStudents = students.filter(student => {
        const name = String(student.name || "").toLowerCase();
        const major = String(student.major || "").toLowerCase();
        const id = String(student.id || "").toLowerCase();

        return (
            name.includes(searchTerm) ||
            major.includes(searchTerm) ||
            id.includes(searchTerm)
        );
    });

    if (filteredStudents.length === 0) {
        const row = document.createElement("tr");
        const cell = document.createElement("td");

        cell.colSpan = 5;

        cell.textContent = searchTerm
            ? "No students match your search."
            : "No students found.";

        cell.className = "empty-table";

        row.appendChild(cell);
        studentList.appendChild(row);
    }

    filteredStudents.forEach(student => {
        const row = document.createElement("tr");

        function addCell(value) {
            const cell = document.createElement("td");
            cell.textContent = String(value ?? "");
            row.appendChild(cell);
            return cell;
        }

        addCell(student.id);
        addCell(student.name);
        addCell(student.age);
        addCell(student.major);

        const actionsCell = document.createElement("td");

        if (isAdmin()) {
            const actions = document.createElement("div");
            actions.className = "actions";

            const editBtn = document.createElement("button");
            editBtn.type = "button";
            editBtn.textContent = "Edit";

            editBtn.addEventListener("click", () => {
                editStudent(student.id);
            });

            const deleteBtn = document.createElement("button");
            deleteBtn.type = "button";
            deleteBtn.textContent = "Delete";
            deleteBtn.className = "delete-btn";

            deleteBtn.addEventListener("click", () => {
                deleteStudent(student.id);
            });

            actions.append(editBtn, deleteBtn);
            actionsCell.appendChild(actions);
        } else {
            actionsCell.textContent = "View only";
        }

        row.appendChild(actionsCell);
        studentList.appendChild(row);
    });

    if (count) {
        count.textContent =
            `Showing ${filteredStudents.length} of ${students.length} students`;
    }

    if (searchResultsEl) {
        searchResultsEl.textContent =
            filteredStudents.length.toLocaleString();
    }

    updateDashboard();
}

/* ==========================================
   RESET STUDENT FORM
========================================== */

function resetStudentForm() {
    if (form) form.reset();

    if (studentIdInput) {
        studentIdInput.value = "";
    }

    editingStudentId = null;

    if (submitBtn) {
        submitBtn.textContent = "Add Student";
        submitBtn.disabled = false;
    }

    if (cancelEditBtn) {
        cancelEditBtn.hidden = true;
    }

    if (formSummary) {
        formSummary.textContent = "+ Add a new student";
    }
}

/* ==========================================
   ADD OR UPDATE STUDENT
   ADMIN ONLY
========================================== */

if (form) {
    form.addEventListener("submit", async event => {
        event.preventDefault();

        if (!isAdmin()) {
            showMessage(
                "Only an Admin can add or edit students.",
                "error"
            );
            return;
        }

        if (!databaseReady) {
            showMessage(
                "Database is not connected. Please reload.",
                "error"
            );
            return;
        }

        const name = nameInput.value.trim();
        const age = Number(ageInput.value);
        const major = majorInput.value.trim();
        const id = editingStudentId;

        if (
            !name ||
            name.length > 100 ||
            !major ||
            major.length > 100 ||
            !Number.isInteger(age) ||
            age < 1 ||
            age > 120
        ) {
            showMessage(
                "Enter a valid name, age (1–120), and major.",
                "error"
            );
            return;
        }

        submitBtn.disabled = true;
        submitBtn.textContent = id ? "Updating..." : "Adding...";

        try {
            if (id) {
                await apiRequest(
                    `/students/${encodeURIComponent(id)}`,
                    {
                        method: "PUT",
                        body: JSON.stringify({
                            name,
                            age,
                            major
                        })
                    }
                );

                showMessage(
                    "Student updated successfully!",
                    "success"
                );
            } else {
                await apiRequest("/students", {
                    method: "POST",
                    body: JSON.stringify({
                        name,
                        age,
                        major
                    })
                });

                showMessage(
                    "Student added successfully!",
                    "success"
                );
            }

            resetStudentForm();

            if (formDisclosure) {
                formDisclosure.open = false;
            }

            await loadStudents();

        } catch (error) {
            console.error("Save student error:", error);

            showMessage(
                `Could not save student: ${error.message}`,
                "error"
            );

        } finally {
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.textContent = editingStudentId
                    ? "Update Student"
                    : "Add Student";
            }
        }
    });
}

/* ==========================================
   EDIT STUDENT
   ADMIN ONLY
========================================== */

function editStudent(id) {
    if (!isAdmin()) {
        showMessage(
            "Only an Admin can edit students.",
            "error"
        );
        return;
    }

    const student = students.find(
        item => String(item.id) === String(id)
    );

    if (!student) {
        showMessage("Student not found.", "error");
        return;
    }

    editingStudentId = String(student.id);

    if (studentIdInput) {
        studentIdInput.value = editingStudentId;
    }

    if (nameInput) {
        nameInput.value = student.name || "";
    }

    if (ageInput) {
        ageInput.value = student.age ?? "";
    }

    if (majorInput) {
        majorInput.value = student.major || "";
    }

    if (submitBtn) {
        submitBtn.textContent = "Update Student";
    }

    if (cancelEditBtn) {
        cancelEditBtn.hidden = false;
    }

    if (formSummary) {
        formSummary.textContent = "Edit student information";
    }

    if (formDisclosure) {
        formDisclosure.open = true;
    }

    if (form) {
        form.scrollIntoView({
            behavior: "smooth",
            block: "center"
        });
    }

    if (nameInput) nameInput.focus();

    showMessage(
        "Edit the information, then click Update Student.",
        "info"
    );
}

/* ==========================================
   CANCEL EDIT
========================================== */

if (cancelEditBtn) {
    cancelEditBtn.addEventListener("click", () => {
        resetStudentForm();

        if (formDisclosure) {
            formDisclosure.open = false;
        }

        showMessage("Edit cancelled.", "info");
    });
}

/* ==========================================
   DELETE STUDENT
   ADMIN ONLY
========================================== */

async function deleteStudent(id) {
    if (!isAdmin()) {
        showMessage(
            "Only an Admin can delete students.",
            "error"
        );
        return;
    }

    const student = students.find(
        item => String(item.id) === String(id)
    );

    if (!student) {
        showMessage("Student not found.", "error");
        return;
    }

    if (!databaseReady) {
        showMessage("Database is not connected.", "error");
        return;
    }

    if (!confirm(`Delete student "${student.name}"?`)) {
        return;
    }

    try {
        await apiRequest(
            `/students/${encodeURIComponent(id)}`,
            {
                method: "DELETE"
            }
        );

        if (String(editingStudentId) === String(id)) {
            resetStudentForm();
        }

        await loadStudents();

        showMessage(
            "Student deleted successfully!",
            "success"
        );

    } catch (error) {
        console.error("Delete student error:", error);

        showMessage(
            `Could not delete student: ${error.message}`,
            "error"
        );
    }
}

/* ==========================================
   SEARCH STUDENTS
========================================== */

if (searchInput) {
    searchInput.addEventListener("input", () => {
        displayStudents(searchInput.value);
    });
}

/* ==========================================
   MOBILE SIDEBAR
========================================== */

function closeSidebar() {
    if (sidebar) {
        sidebar.classList.remove("open");
    }

    if (sidebarOverlay) {
        sidebarOverlay.classList.remove("visible");
    }

    if (menuToggle) {
        menuToggle.setAttribute("aria-expanded", "false");
    }
}

if (menuToggle) {
    menuToggle.addEventListener("click", () => {
        if (!sidebar) return;

        const isOpen = sidebar.classList.toggle("open");

        if (sidebarOverlay) {
            sidebarOverlay.classList.toggle(
                "visible",
                isOpen
            );
        }

        menuToggle.setAttribute(
            "aria-expanded",
            String(isOpen)
        );
    });
}

if (sidebarOverlay) {
    sidebarOverlay.addEventListener(
        "click",
        closeSidebar
    );
}

document.querySelectorAll(".nav-link").forEach(link => {
    link.addEventListener("click", () => {
        document.querySelectorAll(".nav-link").forEach(item => {
            item.classList.remove("active");
        });

        link.classList.add("active");
        closeSidebar();
    });
});

/* ==========================================
   TELEGRAM CONTACT FORM
   Keep the existing Telegram Worker
========================================== */

const contactForm = document.getElementById("contactForm");

if (contactForm) {
    contactForm.addEventListener("submit", async event => {
        event.preventDefault();

        const contactName =
            document.getElementById("contactName");

        const contactMessage =
            document.getElementById("contactMessage");

        const formStatus =
            document.getElementById("formStatus");

        const sendBtn =
            document.getElementById("sendBtn");

        if (
            !contactName ||
            !contactMessage ||
            !formStatus ||
            !sendBtn
        ) {
            console.error(
                "Contact form is missing required HTML elements."
            );
            return;
        }

        const name = contactName.value.trim();
        const messageText = contactMessage.value.trim();

        if (!name || !messageText) {
            formStatus.textContent =
                "Please enter your name and message.";
            return;
        }

        if (
            name.length > 100 ||
            messageText.length > 2000
        ) {
            formStatus.textContent =
                "Your name or message is too long.";
            return;
        }

        sendBtn.disabled = true;
        sendBtn.textContent = "Sending...";
        formStatus.textContent = "Sending your message...";

        try {
            const response = await fetch(
                TELEGRAM_WORKER_URL,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        name,
                        message: messageText
                    })
                }
            );

            let result;

            try {
                result = await response.json();
            } catch {
                throw new Error(
                    `Invalid server response (${response.status}).`
                );
            }

            if (!response.ok || !result.success) {
                throw new Error(
                    result.message ||
                    `Request failed (${response.status}).`
                );
            }

            formStatus.textContent =
                "Message sent successfully!";

            contactForm.reset();

        } catch (error) {
            console.error(
                "Telegram contact form error:",
                error
            );

            formStatus.textContent =
                "Could not send your message. Check your internet connection and Worker CORS settings.";

        } finally {
            sendBtn.disabled = false;
            sendBtn.textContent = "Send Message";
        }
    });
}

/* ==========================================
   INITIALIZE DASHBOARD
========================================== */

setupAuthUI();

if (authToken && currentUser) {
    loadStudents();
}
