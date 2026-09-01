// ---------- Define Photos for Light/Dark Mode ----------
const defaultPhoto = {
  light: 'avatar-light.png',
  dark: 'avatar-dark.png'
};

// ---------- Tab Navigation & Dynamic Filtering ----------
const tabs = document.querySelectorAll('.tab');
const pages = document.querySelectorAll('.page');
const addQuizBtn = document.getElementById('add-quiz-btn');
let currentCategory = 'quiz'; // Default starting category view

// Modal image gallery state variables
let currentModalImages = [];
let currentModalIndex = 0;
let currentModalQuizId = null; // NEW: tracks which card's photos are open in the zoom modal

function goTo(name) {
  tabs.forEach(t => t.classList.toggle('active', t.dataset.page === name));
  pages.forEach(p => p.classList.toggle('active', p.id === 'page-' + name));
  window.scrollTo({ top: 0, behavior: 'smooth' });

  // Hide '+' button on home page, show on others
  if (addQuizBtn) {
    if (name === 'home') {
      addQuizBtn.style.display = 'none';
      updateHomeStats(); // Refresh stats when returning home
    } else {
      addQuizBtn.style.display = 'flex';
      currentCategory = name;
      fetchQuizzes();
    }
  }
}

tabs.forEach(t => t.addEventListener('click', () => goTo(t.dataset.page)));

// ---------- Dark / Light Mode + Photo Swap ----------
const body = document.body;
const themeBtn = document.getElementById('theme-toggle');
const avatarImg = document.getElementById('avatar-img');

function applyAvatarForTheme() {
  if (!avatarImg) return;
  const theme = body.dataset.theme;
  const src = defaultPhoto[theme];
  if (src) {
    avatarImg.src = src;
    avatarImg.classList.add('show');
  } else {
    avatarImg.classList.remove('show');
    avatarImg.src = '';
  }
}

function setTheme(theme) {
  body.dataset.theme = theme;
  applyAvatarForTheme();
}

if (themeBtn) {
  themeBtn.addEventListener('click', () => {
    setTheme(body.dataset.theme === 'light' ? 'dark' : 'light');
  });
}

// Initial render for theme avatar photo
applyAvatarForTheme();

// ---------------------------------------------------------------
// ---------- Custom Confirm / Alert Modal (theme-aware) ----------
// Replaces every window.alert(...) and window.confirm(...) call.
// It reuses the app's existing --bg / --fg / --border-soft CSS
// variables, so it automatically matches light and dark mode.
// ---------------------------------------------------------------
const confirmModal = document.getElementById('confirm-modal');
const confirmTitleEl = document.getElementById('confirm-title');
const confirmMessageEl = document.getElementById('confirm-message');
const confirmCancelBtn = document.getElementById('confirm-cancel-btn');
const confirmOkBtn = document.getElementById('confirm-ok-btn');
const closeConfirmModalBtn = document.getElementById('close-confirm-modal');

/**
 * Shows the custom modal and resolves a Promise<boolean> once the
 * user picks an option.
 * - resolve(true)  -> user pressed the primary/OK button
 * - resolve(false) -> user pressed Cancel or the "x" (or backdrop)
 *
 * options:
 *   title       (string)  heading text
 *   message     (string)  body text
 *   okText      (string)  label for the primary button
 *   cancelText  (string)  label for the cancel button
 *   showCancel  (bool)    false = single-button "alert" style modal
 */
function showConfirmModal({
  title = 'Are you sure?',
  message = '',
  okText = 'Delete',
  cancelText = 'Cancel',
  showCancel = true
} = {}) {
  return new Promise((resolve) => {
    confirmTitleEl.textContent = title;
    confirmMessageEl.textContent = message;
    confirmOkBtn.textContent = okText;
    confirmCancelBtn.textContent = cancelText;
    confirmCancelBtn.style.display = showCancel ? 'inline-block' : 'none';
    confirmOkBtn.classList.toggle('ok-mode', !showCancel);

    confirmModal.classList.add('show');

    function cleanup(result) {
      confirmModal.classList.remove('show');
      confirmOkBtn.removeEventListener('click', onOk);
      confirmCancelBtn.removeEventListener('click', onCancel);
      closeConfirmModalBtn.removeEventListener('click', onCancel);
      confirmModal.removeEventListener('click', onBackdrop);
      resolve(result);
    }
    function onOk() { cleanup(true); }
    function onCancel() { cleanup(false); }
    function onBackdrop(e) {
      if (e.target === confirmModal) cleanup(false);
    }

    confirmOkBtn.addEventListener('click', onOk);
    confirmCancelBtn.addEventListener('click', onCancel);
    closeConfirmModalBtn.addEventListener('click', onCancel);
    confirmModal.addEventListener('click', onBackdrop);
  });
}

/**
 * Drop-in replacement for window.alert(). Shows a single-button
 * themed modal and resolves once the user dismisses it.
 */
function showAlertModal(message, title = 'Notice') {
  return showConfirmModal({ title, message, okText: 'OK', showCancel: false });
}

// ---------- Dashboard Home Stats Fetcher ----------
async function updateHomeStats() {
  try {
    const response = await fetch('http://localhost:5000/api/quizzes');
    const quizzes = await response.json();

    if (!Array.isArray(quizzes)) return;

    let quizCount = 0;
    let examCount = 0;
    let activityCount = 0;

    quizzes.forEach(q => {
      const cat = q.category ? q.category.toLowerCase() : '';
      if (cat === 'quiz') quizCount++;
      else if (cat === 'exam') examCount++;
      else if (cat === 'activity') activityCount++;
    });

    const statQuizEl = document.getElementById('stat-quiz');
    const statExamEl = document.getElementById('stat-exam');
    const statActivityEl = document.getElementById('stat-activity');

    if (statQuizEl) statQuizEl.textContent = quizCount;
    if (statExamEl) statExamEl.textContent = examCount;
    if (statActivityEl) statActivityEl.textContent = activityCount;
  } catch (err) {
    console.error('Error loading stats:', err);
  }
}

// ---------- Fetch Quizzes from MySQL & Render Filtered & Sorted HTML ----------
async function fetchQuizzes() {
  try {
    const response = await fetch('http://localhost:5000/api/quizzes');
    const quizzes = await response.json();

    // Select the correct container depending on the active tab category
    const containerId = currentCategory === 'exam' ? 'exam-list' : currentCategory === 'activity' ? 'activity-list' : 'quiz-list';
    const container = document.getElementById(containerId);

    if (!container) return;

    container.innerHTML = '';

    if (!Array.isArray(quizzes)) return;

    // Filter cards to match the currently selected category tab
    const filteredQuizzes = quizzes.filter(
      quiz => quiz.category && quiz.category.toLowerCase() === currentCategory.toLowerCase()
    );

    // Sort the cards strictly from lowest number to highest number (1, 2, 3...)
    filteredQuizzes.sort((a, b) => {
      const getNum = (title) => {
        if (!title) return 0;
        const match = title.match(/\d+/);
        return match ? parseInt(match[0], 10) : 0;
      };
      return getNum(a.title) - getNum(b.title);
    });

    if (filteredQuizzes.length === 0) {
      container.innerHTML = `<p style="margin-top:15px; color:var(--fg);">No ${currentCategory}s found.</p>`;
      return;
    }

    filteredQuizzes.forEach(quiz => {
      const card = document.createElement('div');
      card.className = 'quiz-card';

      // Parse multi-image array safely from database string
      let imagesArray = [];
      try {
        imagesArray = quiz.image_url ? JSON.parse(quiz.image_url) : [];
        if (!Array.isArray(imagesArray)) imagesArray = [quiz.image_url];
      } catch (e) {
        imagesArray = quiz.image_url ? [quiz.image_url] : [];
      }

      // Generate HTML for each image attached to the card, each with its OWN delete "x" button
      let imageHTML = '';
      imagesArray.forEach((url, index) => {
        imageHTML += `
          <div class="img-wrap" style="position:relative; margin-bottom:8px;">
            <img src="${url}" alt="Quiz Photo ${index + 1}" class="zoomable-img"
              style="width:100%; height:140px; object-fit:cover; border-radius:8px; cursor:pointer; display:block;"
              title="Click to view full image" data-fullurl="${url}" />
            <button type="button" class="remove-single-photo-btn" data-index="${index}"
              title="Remove this photo"
              style="position:absolute; top:6px; right:6px; width:24px; height:24px; border-radius:50%; border:none; background:rgba(0,0,0,0.65); color:white; font-size:14px; line-height:1; cursor:pointer;">&times;</button>
          </div>`;
      });

      card.innerHTML = `
        <h3>${quiz.title}</h3>
        <span class="badge ${quiz.category ? quiz.category.toLowerCase() : 'quiz'}">${quiz.category ? quiz.category.toUpperCase() : 'QUIZ'}</span>

        <div class="card-images-container" style="display: flex; flex-direction: column; margin-top: 12px; margin-bottom: 12px;">
          ${imageHTML}
        </div>

        <div style="display: flex; flex-direction: column; gap: 6px; margin-top: auto;">
          <input type="file" id="file-${quiz.id}" accept="image/*" style="font-size: 11px;" />
          <button type="button" class="upload-btn" style="padding: 6px 8px; font-size: 12px; cursor: pointer;">Upload Photo</button>
          <button type="button" class="delete-btn" style="padding: 6px 8px; font-size: 12px; background-color: #ff4d4d; color: white; border: none; border-radius: 4px; cursor: pointer; margin-top: 4px;">Delete</button>
        </div>
      `;

      // Click individual image to open preview modal listener with multi-image gallery index tracking
      const cardImgs = card.querySelectorAll('.zoomable-img');
      cardImgs.forEach((img, idx) => {
        img.addEventListener('click', () => {
          currentModalImages = imagesArray;
          currentModalIndex = idx;
          currentModalQuizId = quiz.id; // remember which card these photos belong to

          const imageModal = document.getElementById('image-modal');
          const modalImg = document.getElementById('modal-img');
          if (imageModal && modalImg) {
            modalImg.src = currentModalImages[currentModalIndex];
            imageModal.classList.add('show');
            if (typeof updateModalArrowsVisibility === 'function') {
              updateModalArrowsVisibility();
            }
          }
        });
      });

      // Remove SINGLE photo listener (one "x" button per image, on the card thumbnail)
      const removeSingleBtns = card.querySelectorAll('.remove-single-photo-btn');
      removeSingleBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation(); // don't also trigger the image-preview modal
          const idx = parseInt(btn.dataset.index, 10);
          removeSinglePhoto(quiz.id, idx, imagesArray);
        });
      });

      // Upload listener
      const uploadBtn = card.querySelector('.upload-btn');
      uploadBtn.addEventListener('click', () => uploadCardPhoto(quiz.id));

      // Delete card listener
      const deleteBtn = card.querySelector('.delete-btn');
      deleteBtn.addEventListener('click', () => deleteCard(quiz.id));

      container.appendChild(card);
    });

  } catch (error) {
    console.error('Error connecting to backend:', error);
  }
}

// Upload function (appends picture)
async function uploadCardPhoto(quizId) {
  const fileInput = document.getElementById(`file-${quizId}`);
  if (!fileInput || !fileInput.files[0]) {
    await showAlertModal('Please select a photo first!', 'Missing Photo');
    return;
  }

  const formData = new FormData();
  formData.append('image', fileInput.files[0]);

  try {
    const response = await fetch(`http://localhost:5000/api/quizzes/${quizId}/upload`, {
      method: 'POST',
      body: formData
    });

    const result = await response.json();
    if (response.ok) {
      await showAlertModal('Photo attached!', 'Success');
      fetchQuizzes();
    } else {
      await showAlertModal('Upload failed: ' + (result.error || 'Server error'), 'Upload Failed');
    }
  } catch (err) {
    console.error('Upload error:', err);
    await showAlertModal('Failed to connect to backend server for upload.', 'Connection Error');
  }
}

// Remove ONE photo from a card, keep the rest.
// Sends the trimmed array back to the server via PUT /api/quizzes/:id/photo.
// Optionally returns the updated array so callers (like the zoom modal) can
// refresh their own local state without needing a full re-fetch.
async function removeSinglePhoto(quizId, index, imagesArray, skipConfirm = false) {
  if (!skipConfirm) {
    const confirmed = await showConfirmModal({
      title: 'Remove Photo',
      message: 'Remove this photo?',
      okText: 'Remove'
    });
    if (!confirmed) return null;
  }

  const updatedImages = imagesArray.filter((_, i) => i !== index);

  try {
    const response = await fetch(`http://localhost:5000/api/quizzes/${quizId}/photo`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image_url: JSON.stringify(updatedImages) })
    });

    const result = await response.json();
    if (response.ok) {
      fetchQuizzes();
      return updatedImages;
    } else {
      await showAlertModal('Failed to remove photo: ' + (result.error || 'Server error'), 'Remove Failed');
      return null;
    }
  } catch (err) {
    console.error('Remove photo error:', err);
    await showAlertModal('Failed to connect to server.', 'Connection Error');
    return null;
  }
}

// Delete full card function
async function deleteCard(quizId) {
  const confirmed = await showConfirmModal({
    title: 'Delete',
    message: 'Are you sure you want to delete this?',
    okText: 'Delete'
  });
  if (!confirmed) return;

  try {
    const response = await fetch(`http://localhost:5000/api/quizzes/${quizId}`, {
      method: 'DELETE'
    });

    const result = await response.json();
    if (response.ok) {
      await showAlertModal('deleted!', 'Deleted');
      fetchQuizzes();
      updateHomeStats();
    } else {
      await showAlertModal('Failed to delete: ' + (result.error || 'Server error'), 'Delete Failed');
    }
  } catch (err) {
    console.error('Delete error:', err);
    await showAlertModal('Failed to connect to backend server for deletion.', 'Connection Error');
  }
}

// Global scope helper visibility function for modal arrows
function updateModalArrowsVisibility() {
  const prevBtn = document.getElementById('modal-prev-btn');
  const nextBtn = document.getElementById('modal-next-btn');
  if (prevBtn && nextBtn) {
    prevBtn.style.display = currentModalIndex > 0 ? 'block' : 'none';
    nextBtn.style.display = currentModalIndex < currentModalImages.length - 1 ? 'block' : 'none';
  }
}

// ---------- Add Quiz Modal & Event Handlers ----------
document.addEventListener('DOMContentLoaded', () => {
  updateHomeStats();

  const activeTab = document.querySelector('.tab.active');
  if (activeTab) {
    const pageName = activeTab.dataset.page;
    if (addQuizBtn) {
      addQuizBtn.style.display = pageName === 'home' ? 'none' : 'flex';
    }
    if (pageName !== 'home') {
      currentCategory = pageName;
      fetchQuizzes();
    }
  }

  const quizModal = document.getElementById('quiz-modal');
  const closeModal = document.querySelector('.close-modal');
  const addQuizForm = document.getElementById('add-quiz-form');

  const imageModal = document.getElementById('image-modal');
  const modalImg = document.getElementById('modal-img');
  const closeImageModal = document.getElementById('close-image-modal');

  // Create navigation arrows + a delete button dynamically if they don't exist yet
  // inside the image-modal. All three attach to the inner ".modal-content" box,
  // and THAT gets position:relative — not the outer "imageModal" overlay — so
  // imageModal's CSS position:fixed (which centers the whole overlay on screen)
  // is never overridden.
  const imageModalContent = imageModal ? imageModal.querySelector('.modal-content') : null;

  if (imageModalContent && !document.getElementById('modal-prev-btn')) {
    const prevBtn = document.createElement('button');
    prevBtn.id = 'modal-prev-btn';
    prevBtn.innerHTML = '&#10094;'; // Left arrow symbol
    prevBtn.style.cssText = "position: absolute; left: 20px; top: 50%; transform: translateY(-50%); background: rgba(0,0,0,0.6); color: white; border: none; font-size: 24px; padding: 10px 15px; cursor: pointer; border-radius: 50%; z-index: 1000;";

    const nextBtn = document.createElement('button');
    nextBtn.id = 'modal-next-btn';
    nextBtn.innerHTML = '&#10095;'; // Right arrow symbol
    nextBtn.style.cssText = "position: absolute; right: 20px; top: 50%; transform: translateY(-50%); background: rgba(0,0,0,0.6); color: white; border: none; font-size: 24px; padding: 10px 15px; cursor: pointer; border-radius: 50%; z-index: 1000;";

    // NEW: delete button, centered at the bottom of the zoomed image
    const deleteInModalBtn = document.createElement('button');
    deleteInModalBtn.id = 'modal-delete-btn';
    deleteInModalBtn.innerHTML = '&#128465; Remove Photo'; // trash can icon + label
    deleteInModalBtn.style.cssText = "position: absolute; bottom: 20px; left: 50%; transform: translateX(-50%); background: rgba(220,53,69,0.9); color: white; border: none; font-size: 14px; font-weight: 600; padding: 10px 18px; cursor: pointer; border-radius: 24px; z-index: 1000; white-space: nowrap;";

    imageModalContent.style.position = 'relative';
    imageModalContent.appendChild(prevBtn);
    imageModalContent.appendChild(nextBtn);
    imageModalContent.appendChild(deleteInModalBtn);

    prevBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (currentModalIndex > 0) {
        currentModalIndex--;
        modalImg.src = currentModalImages[currentModalIndex];
        updateModalArrowsVisibility();
      }
    });

    nextBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (currentModalIndex < currentModalImages.length - 1) {
        currentModalIndex++;
        modalImg.src = currentModalImages[currentModalIndex];
        updateModalArrowsVisibility();
      }
    });

    // NEW: delete the currently viewed photo without leaving the zoom modal
    deleteInModalBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (currentModalQuizId === null) return;

      const updatedImages = await removeSinglePhoto(
        currentModalQuizId,
        currentModalIndex,
        currentModalImages,
        false // still asks "Remove this photo?" for confirmation via the themed modal
      );

      if (updatedImages === null) return; // user cancelled or request failed

      currentModalImages = updatedImages;

      if (currentModalImages.length === 0) {
        // No photos left on this card — close the zoom modal
        imageModal.classList.remove('show');
      } else {
        // Stay open, show the next available photo (or the last one if we deleted the last index)
        if (currentModalIndex >= currentModalImages.length) {
          currentModalIndex = currentModalImages.length - 1;
        }
        modalImg.src = currentModalImages[currentModalIndex];
        updateModalArrowsVisibility();
      }
    });
  }

  if (addQuizBtn) {
    addQuizBtn.addEventListener('click', async () => {
      const modalHeading = document.getElementById('modal-heading');
      const categorySelect = document.getElementById('quiz-category');
      const titleInput = document.getElementById('quiz-title');

      if (modalHeading && categorySelect) {
        const formattedCategory = currentCategory.charAt(0).toUpperCase() + currentCategory.slice(1);
        modalHeading.textContent = `Add New ${formattedCategory}`;
        categorySelect.value = currentCategory.toLowerCase();
      }

      try {
        const checkRes = await fetch('http://localhost:5000/api/quizzes');
        const existingQuizzes = await checkRes.json();

        const targetCat = currentCategory.toLowerCase();
        const usedNumbers = new Set();

        if (Array.isArray(existingQuizzes)) {
          existingQuizzes.forEach(q => {
            if (q.category && q.category.toLowerCase() === targetCat && q.title) {
              const match = q.title.match(/(\d+)$/);
              if (match) {
                usedNumbers.add(parseInt(match[1], 10));
              }
            }
          });
        }

        let nextNumber = 1;
        while (usedNumbers.has(nextNumber)) {
          nextNumber++;
        }

        if (titleInput) {
          titleInput.value = `${currentCategory.toUpperCase()} ${nextNumber}`;
        }
      } catch (err) {
        console.error('Error generating auto-numbering title:', err);
      }

      quizModal.classList.add('show');
    });
  }

  if (closeModal) {
    closeModal.addEventListener('click', () => {
      quizModal.classList.remove('show');
    });
  }

  if (closeImageModal) {
    closeImageModal.addEventListener('click', () => {
      imageModal.classList.remove('show');
    });
  }

  window.addEventListener('click', (e) => {
    if (e.target === quizModal) {
      quizModal.classList.remove('show');
    }
    if (e.target === imageModal) {
      imageModal.classList.remove('show');
    }
  });

  if (addQuizForm) {
    addQuizForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const title = document.getElementById('quiz-title').value;
      const category = document.getElementById('quiz-category').value;

      try {
        const response = await fetch('http://localhost:5000/api/quizzes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title, category })
        });

        const result = await response.json();

        if (response.ok) {
          await showAlertModal(`Successfully added ${title}!`, 'Success');
          addQuizForm.reset();
          quizModal.classList.remove('show');
          updateHomeStats();
          goTo(category);
        } else {
          await showAlertModal('Failed to add: ' + (result.error || 'Server error'), 'Add Failed');
        }
      } catch (err) {
        console.error('Error creating quiz:', err);
        await showAlertModal('Could not connect to backend server.', 'Connection Error');
      }
    });
  }
});