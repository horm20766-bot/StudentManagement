
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

const STORAGE_KEY = "studentRecords";

let students = JSON.parse(
    localStorage.getItem(STORAGE_KEY) || "[]"
);

// Save data
function saveStudents() {
    localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(students)
    );
}

// Display data
function displayStudents(keyword = "") {
    studentList.replaceChildren();

    const filtered = students.filter(student =>
        student.name.toLowerCase().includes(keyword.toLowerCase()) ||
        student.major.toLowerCase().includes(keyword.toLowerCase())
    );

    filtered.forEach(student => {
        const tr = document.createElement("tr");

        function addCell(value) {
            const td = document.createElement("td");
            td.textContent = value;
            tr.appendChild(td);
        }

        addCell(student.id);
        addCell(student.name);
        addCell(student.age);
        addCell(student.major);

        const actions = document.createElement("td");
        const actionGroup = document.createElement("div");
        actionGroup.className = "actions";

        const editBtn = document.createElement("button");
        editBtn.textContent = "Edit";
        editBtn.addEventListener("click", () => editStudent(student.id));

        const deleteBtn = document.createElement("button");
        deleteBtn.textContent = "Delete";
        deleteBtn.className = "delete-btn";
        deleteBtn.addEventListener("click", () => deleteStudent(student.id));

        actionGroup.append(editBtn, deleteBtn);
        actions.appendChild(actionGroup);
        tr.appendChild(actions);

        studentList.appendChild(tr);
    });

    count.textContent =
        `Showing ${filtered.length} of ${students.length} students`;
}

// Add or update student
form.addEventListener("submit", event => {
    event.preventDefault();

    const name = nameInput.value.trim();
    const age = Number(ageInput.value);
    const major = majorInput.value.trim();
    const id = studentIdInput.value;

    if (!name || !major || !Number.isInteger(age) || age < 1 || age > 120) {
        message.textContent = "Please enter valid student information.";
        return;
    }

    if (id) {
        const student = students.find(item => item.id === id);

        if (!student) {
            message.textContent = "Student not found.";
            return;
        }

        student.name = name;
        student.age = age;
        student.major = major;

        message.textContent = "Student updated successfully!";
    } else {
        students.push({
            id: String(Date.now()) + Math.random().toString(36).slice(2, 7),
            name,
            age,
            major
        });

        message.textContent = "Student added successfully!";
    }

    saveStudents();
    form.reset();
    studentIdInput.value = "";
    submitBtn.textContent = "Add Student";
    displayStudents(searchInput.value);
});

// Edit student
function editStudent(id) {
    const student = students.find(item => item.id === id);

    if (!student) return;

    studentIdInput.value = student.id;
    nameInput.value = student.name;
    ageInput.value = student.age;
    majorInput.value = student.major;

    submitBtn.textContent = "Update Student";
    message.textContent = "Edit the information, then click Update Student.";
    nameInput.focus();
}

// Delete student
function deleteStudent(id) {
    const student = students.find(item => item.id === id);

    if (!student) return;

    if (!confirm(`Delete student "${student.name}"?`)) return;

    students = students.filter(item => item.id !== id);

    saveStudents();
    displayStudents(searchInput.value);
    message.textContent = "Student deleted successfully!";
}

// Search students
searchInput.addEventListener("input", () => {
    displayStudents(searchInput.value);
});

// Load saved data when opening the page
displayStudents();
