const API = '/api/opportunities';

const $ = (id) => document.getElementById(id);

const FIELDS = [
  'title', 'faculty_name', 'research_area', 'department',
  'required_skills', 'positions', 'deadline', 'description'
];

let messageTimer;

// ---------- small helpers ----------

// Stops text from being treated as HTML (protects against XSS)
function esc(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function showMessage(text, type) {
  const box = $('message');
  box.textContent = text;
  box.className = 'message ' + type;
  clearTimeout(messageTimer);
  messageTimer = setTimeout(() => {
    box.className = 'message hidden';
  }, 5000);
}

// One function that talks to the backend and handles errors the same way every time
async function request(url, options) {
  let res;
  try {
    res = await fetch(url, options);
  } catch (e) {
    throw new Error('Could not reach the server. Is it running?');
  }

  let data = null;
  try {
    data = await res.json();
  } catch (e) {
    // response had no JSON body
  }

  if (!res.ok) {
    let text = (data && data.message) || 'Request failed';
    if (data && data.errors && data.errors.length > 0) {
      text += ': ' + data.errors.join(', ');
    }
    throw new Error(text);
  }

  return data;
}

function sendJson(method, body) {
  return {
    method: method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  };
}

// ---------- showing and hiding sections ----------

function hideForm() {
  $('formSection').classList.add('hidden');
}

function hideDetails() {
  $('detailsSection').classList.add('hidden');
}

function clearErrors() {
  FIELDS.forEach((f) => {
    $('err_' + f).textContent = '';
  });
}

function openCreateForm() {
  hideDetails();
  clearErrors();
  $('oppForm').reset();
  $('oppId').value = '';
  $('status').value = 'Open';
  $('formTitle').textContent = 'New Opportunity';
  $('formSection').classList.remove('hidden');
  $('title').focus();
}

// ---------- load and draw the list ----------

async function loadAll() {
  try {
    const list = await request(API);
    drawTable(list);
  } catch (err) {
    $('oppBody').innerHTML = '<tr><td colspan="8" class="empty">Could not load opportunities.</td></tr>';
    showMessage(err.message, 'error');
  }
}

function drawTable(list) {
  const body = $('oppBody');

  if (list.length === 0) {
    body.innerHTML = '<tr><td colspan="8" class="empty">No research opportunities yet. Add the first one.</td></tr>';
    return;
  }

  body.innerHTML = list.map((o) => {
    const isOpen = o.status === 'Open';
    const statusClass = isOpen ? 'status-open' : 'status-closed';
    const closeButton = isOpen
      ? `<button class="btn small" data-action="close" data-id="${o.id}">Close</button>`
      : '';

    return `
      <tr>
        <td>${o.id}</td>
        <td>${esc(o.title)}</td>
        <td>${esc(o.faculty_name)}</td>
        <td>${esc(o.research_area)}</td>
        <td>${o.positions}</td>
        <td>${esc(o.deadline)}</td>
        <td class="${statusClass}">${esc(o.status)}</td>
        <td class="actions">
          <button class="btn small" data-action="view" data-id="${o.id}">View</button>
          <button class="btn small" data-action="edit" data-id="${o.id}">Edit</button>
          ${closeButton}
          <button class="btn small danger" data-action="delete" data-id="${o.id}">Delete</button>
        </td>
      </tr>`;
  }).join('');
}

// ---------- view one ----------

async function viewOne(id) {
  try {
    const o = await request(`${API}/${id}`);
    hideForm();

    const rows = [
      ['ID', o.id],
      ['Title', o.title],
      ['Faculty member', o.faculty_name],
      ['Department', o.department],
      ['Research area', o.research_area],
      ['Required skills', o.required_skills],
      ['Available positions', o.positions],
      ['Application deadline', o.deadline],
      ['Status', o.status],
      ['Description', o.description]
    ];

    $('detailsList').innerHTML = rows
      .map(([label, value]) => `<dt>${label}</dt><dd>${esc(value)}</dd>`)
      .join('');

    $('detailsSection').classList.remove('hidden');
    $('detailsSection').scrollIntoView({ behavior: 'smooth' });
  } catch (err) {
    showMessage(err.message, 'error');
    loadAll();
  }
}

// ---------- edit ----------

async function startEdit(id) {
  try {
    const o = await request(`${API}/${id}`);
    hideDetails();
    clearErrors();

    $('oppId').value = o.id;
    FIELDS.forEach((f) => {
      $(f).value = o[f];
    });
    $('status').value = o.status;

    $('formTitle').textContent = 'Edit Opportunity #' + o.id;
    $('formSection').classList.remove('hidden');
    $('formSection').scrollIntoView({ behavior: 'smooth' });
  } catch (err) {
    showMessage(err.message, 'error');
    loadAll();
  }
}

// ---------- close (Open -> Closed) ----------

async function closeOpportunity(id) {
  try {
    await request(`${API}/${id}`, sendJson('PUT', { status: 'Closed' }));
    showMessage('Opportunity #' + id + ' has been closed.', 'success');
    loadAll();
  } catch (err) {
    showMessage(err.message, 'error');
  }
}

// ---------- delete ----------

async function deleteOpportunity(id) {
  if (!confirm('Delete opportunity #' + id + '? This cannot be undone.')) {
    return;
  }
  try {
    await request(`${API}/${id}`, { method: 'DELETE' });
    showMessage('Opportunity #' + id + ' was deleted.', 'success');
    hideDetails();
    loadAll();
  } catch (err) {
    showMessage(err.message, 'error');
    loadAll();
  }
}

// ---------- form validation and saving ----------

function validateForm() {
  clearErrors();
  let ok = true;

  FIELDS.forEach((f) => {
    if ($(f).value.trim() === '') {
      $('err_' + f).textContent = 'This field is required';
      ok = false;
    }
  });

  const posText = $('positions').value.trim();
  if (posText !== '') {
    const n = Number(posText);
    if (!Number.isInteger(n) || n < 1) {
      $('err_positions').textContent = 'Enter a whole number of 1 or more';
      ok = false;
    }
  }

  return ok;
}

$('oppForm').addEventListener('submit', async (e) => {
  e.preventDefault();

  if (!validateForm()) {
    showMessage('Please fix the highlighted fields.', 'error');
    return;
  }

  const data = {
    title: $('title').value.trim(),
    faculty_name: $('faculty_name').value.trim(),
    research_area: $('research_area').value.trim(),
    department: $('department').value.trim(),
    required_skills: $('required_skills').value.trim(),
    positions: Number($('positions').value),
    deadline: $('deadline').value,
    description: $('description').value.trim(),
    status: $('status').value
  };

  const id = $('oppId').value;

  try {
    if (id) {
      await request(`${API}/${id}`, sendJson('PUT', data));
      showMessage('Opportunity #' + id + ' was updated.', 'success');
    } else {
      await request(API, sendJson('POST', data));
      showMessage('New opportunity was created.', 'success');
    }
    hideForm();
    loadAll();
  } catch (err) {
    showMessage(err.message, 'error');
  }
});

// ---------- button wiring ----------

$('newBtn').addEventListener('click', openCreateForm);
$('cancelBtn').addEventListener('click', hideForm);
$('closeDetailsBtn').addEventListener('click', hideDetails);

// One listener for every button inside the table
$('oppBody').addEventListener('click', (e) => {
  const btn = e.target.closest('button');
  if (!btn) return;

  const id = btn.dataset.id;
  const action = btn.dataset.action;

  if (action === 'view') viewOne(id);
  if (action === 'edit') startEdit(id);
  if (action === 'close') closeOpportunity(id);
  if (action === 'delete') deleteOpportunity(id);
});

// Load the list when the page opens
loadAll();