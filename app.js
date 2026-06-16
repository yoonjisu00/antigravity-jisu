// app.js

const GEMINI_API_KEY = "AQ.Ab8RN6K5enfrvVPighfg6k17hKLuxdGIPRtndxK2spbDRIlXiA";

const fallbackRestaurants = [
    { id: 1, name: "끄트머리집", address: "성북구 고려대로24길 61 1층" },
    { id: 2, name: "호랑이 초밥", address: "성북구 고려대로24길 61 2,3층" },
    { id: 3, name: "매스 플레이트 안암", address: "성북구 개운사길 18 2층" },
    { id: 4, name: "토로 생선구이", address: "성북구 고려대로28길 14-1" },
    { id: 5, name: "미스터국밥", address: "성북구 고려대로 102" },
    { id: 6, name: "무르무르드구스토", address: "성북구 고려대로 102-2 4층" },
    { id: 7, name: "특별식당", address: "성북구 개운사길 22-6 2층" },
    { id: 8, name: "서울쌈냉면", address: "성북구 개운사길 21-4" },
    { id: 9, name: "용초수", address: "성북구 고려대로27길 20" },
    { id: 10, name: "효이당", address: "성북구 고려대로27길 30-2" }
];

let restaurantsData = [];
let currentRestaurantId = null;
let useLocalStorage = false;

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    loadRestaurants();
    setupEventListeners();
    loadReservations();
    loadDailyAiRecommendation();
});

function getDailyRestaurant() {
    const today = new Date();
    // Calculate day of the year (0 to 365)
    const start = new Date(today.getFullYear(), 0, 0);
    const diff = today - start;
    const oneDay = 1000 * 60 * 60 * 24;
    const dayOfYear = Math.floor(diff / oneDay);
    
    // Pick one restaurant based on the day of the year
    const index = dayOfYear % fallbackRestaurants.length;
    return fallbackRestaurants[index];
}

let dailyRestaurantCache = null;

async function loadDailyAiRecommendation() {
    const content = document.getElementById('daily-ai-content');
    const desc = document.getElementById('daily-ai-desc');
    
    dailyRestaurantCache = getDailyRestaurant();
    document.getElementById('daily-rest-name').innerText = dailyRestaurantCache.name;

    if (!GEMINI_API_KEY || GEMINI_API_KEY === "여기에 발급받으신 API 키를 붙여넣으세요") {
        content.innerHTML = "<p style='color: rgba(255,255,255,0.8); font-size: 0.95rem;'>💡 <b>팁:</b> <code>app.js</code> 파일 첫 번째 줄에 API 키를 입력하시면 AI가 매일 이 식당에 대한 특별한 추천사를 적어줍니다!</p>";
        return;
    }

    const todayStr = new Date().toDateString();
    const cached = JSON.parse(localStorage.getItem('daily_ai') || '{}');
    
    // Use cached recommendation if we already fetched it today for the same restaurant
    if (cached.date === todayStr && cached.restId === dailyRestaurantCache.id) {
        desc.innerHTML = cached.desc;
        document.querySelector('.daily-ai-content .loading-spinner').style.display = 'none';
        return;
    }

    try {
        const systemPrompt = `당신은 안암동 맛집 전용 AI 캐치봇입니다. 
오늘의 추천 식당은 '${dailyRestaurantCache.name}' (주소: ${dailyRestaurantCache.address}) 입니다. 
이 식당을 방문하는 사람들에게 오늘 하루 이 식당이 왜 특별하게 좋은지, 2~3문장으로 짧고 매력적으로 추천사(이모지 포함)를 써주세요.`;
        
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: systemPrompt }] }] })
        });
        
        if (!response.ok) throw new Error('API Error');
        const data = await response.json();
        const aiText = data.candidates[0].content.parts[0].text;
        
        const formattedText = aiText.replace(/\n/g, '<br>');
        desc.innerHTML = formattedText;
        document.querySelector('.daily-ai-content .loading-spinner').style.display = 'none';
        
        localStorage.setItem('daily_ai', JSON.stringify({
            date: todayStr,
            restId: dailyRestaurantCache.id,
            desc: formattedText
        }));
    } catch (e) {
        desc.innerText = "오늘의 추천을 불러오는 데 실패했습니다. 잠시 후 다시 시도해주세요.";
        document.querySelector('.daily-ai-content .loading-spinner').style.display = 'none';
    }
}

function openReservationFromDaily() {
    if (dailyRestaurantCache) {
        openReservationModal(dailyRestaurantCache.id, dailyRestaurantCache.name);
    }
}

async function loadReservations() {
    const list = document.getElementById('reservationList');
    const countBadge = document.getElementById('reservationCount');
    let reservations = [];
    
    if (useLocalStorage) {
        reservations = JSON.parse(localStorage.getItem('reservations') || '[]');
    } else {
        try {
            const res = await fetch('/api/reservations');
            if (res.ok) reservations = await res.json();
            else reservations = JSON.parse(localStorage.getItem('reservations') || '[]');
        } catch(e) {
            reservations = JSON.parse(localStorage.getItem('reservations') || '[]');
        }
    }
    
    countBadge.innerText = reservations.length;
    list.innerHTML = '';
    
    if (reservations.length === 0) {
        list.innerHTML = '<div class="no-reviews" style="font-size: 0.9rem; margin-top: 2rem;">아직 예약 내역이 없습니다.</div>';
        return;
    }
    
    reservations.forEach(r => {
        // Find restaurant name
        const rest = fallbackRestaurants.find(x => String(x.id) === String(r.restaurantId));
        const restName = rest ? rest.name : '알 수 없는 식당';
        
        const item = document.createElement('div');
        item.className = 'res-item';
        item.innerHTML = `
            <h4>${restName}</h4>
            <p>예약자: ${r.name}</p>
            <p>인원: ${r.people}명</p>
            <span class="res-time">⏰ ${r.time}</span>
        `;
        list.appendChild(item);
    });
}

async function loadRestaurants() {
    const grid = document.getElementById('restaurantGrid');
    
    try {
        const response = await fetch('/api/restaurants');
        if (!response.ok) throw new Error('Network response was not ok');
        restaurantsData = await response.json();
    } catch (error) {
        console.warn("Backend API not available, falling back to local data.", error);
        restaurantsData = fallbackRestaurants;
        useLocalStorage = true;
    }
    
    renderRestaurants();
}

function renderRestaurants() {
    const grid = document.getElementById('restaurantGrid');
    grid.innerHTML = '';
    
    restaurantsData.forEach(rest => {
        const card = document.createElement('div');
        card.className = 'restaurant-card';
        card.innerHTML = `
            <div class="card-title">${rest.name}</div>
            <div class="card-address">📍 ${rest.address}</div>
            <div class="card-actions">
                <button class="btn-details" onclick="openDetailsModal(${rest.id}, '${rest.name}')">평점 및 리뷰</button>
                <button class="btn-reserve" onclick="openReservationModal(${rest.id}, '${rest.name}')">예약하기</button>
            </div>
        `;
        grid.appendChild(card);
    });
}

function setupEventListeners() {
    // Star rating
    const stars = document.querySelectorAll('.star');
    stars.forEach(star => {
        star.addEventListener('click', (e) => {
            const value = e.target.getAttribute('data-value');
            document.getElementById('rev-rating').value = value;
            
            stars.forEach(s => s.classList.remove('selected'));
            e.target.classList.add('selected');
        });
    });

    // Form submissions
    document.getElementById('reservationForm').addEventListener('submit', handleReservationSubmit);
    document.getElementById('reviewForm').addEventListener('submit', handleReviewSubmit);
    
    // Details modal action buttons
    document.getElementById('btn-open-review').addEventListener('click', () => {
        const name = document.getElementById('det-restaurant-name').innerText;
        closeModal('detailsModal');
        openReviewModal(currentRestaurantId, name);
    });
    
    document.getElementById('btn-open-reservation-from-details').addEventListener('click', () => {
        const name = document.getElementById('det-restaurant-name').innerText;
        closeModal('detailsModal');
        openReservationModal(currentRestaurantId, name);
    });

    // Check if API key is already saved when page loads
    // Modifying this part since we use hardcoded API key for chatbot now as well
    if (GEMINI_API_KEY && GEMINI_API_KEY !== "여기에 발급받으신 API 키를 붙여넣으세요") {
        document.getElementById('ai-api-key') ? document.getElementById('ai-api-key').value = "HARDCODED_KEY_USED" : null;
    }
}

// AI Functions
function askAi() {
    const prompt = document.getElementById('ai-prompt').value.trim();
    if (!prompt) {
        alert("질문을 입력해주세요!");
        return;
    }
    
    if (!GEMINI_API_KEY || GEMINI_API_KEY === "여기에 발급받으신 API 키를 붙여넣으세요") {
        alert("app.js 파일 상단에 API 키를 입력해주세요!");
        return;
    }

    const restaurantListContext = fallbackRestaurants.map(r => `- ${r.name} (${r.address})`).join('\\n');
    
    const systemPrompt = `당신은 고려대학교 안암동 맛집을 추천해주는 친절한 AI 비서 '캐치봇'입니다.
현재 우리 서비스에 등록된 맛집 리스트는 다음과 같습니다:
${restaurantListContext}

사용자의 요청에 맞게 위 10가지 식당 중에서 가장 적합한 식당을 1~2개 골라서 친절하게 추천해주세요. 다른 식당은 추천하지 마세요. 대답은 한국어로 부드럽고 친절한 톤으로 작성해주세요.`;

    const requestBody = {
        contents: [{
            parts: [{ text: systemPrompt + "\\n\\n사용자 질문: " + prompt }]
        }]
    };

    document.getElementById('btn-ask-ai').disabled = true;
    document.getElementById('ai-loading').style.display = 'block';
    document.getElementById('ai-response').style.display = 'none';

    fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
    })
    .then(response => {
        if (!response.ok) throw new Error(`API 요청 실패 - API 키를 확인해주세요.`);
        return response.json();
    })
    .then(data => {
        const aiText = data.candidates[0].content.parts[0].text;
        document.getElementById('ai-response').innerHTML = aiText.replace(/\\n/g, '<br>').replace(/\n/g, '<br>');
        document.getElementById('ai-response').style.display = 'block';
    })
    .catch(error => {
        document.getElementById('ai-response').innerHTML = `<span style="color:red;">❌ 오류 발생: ${error.message}</span>`;
        document.getElementById('ai-response').style.display = 'block';
    })
    .finally(() => {
        document.getElementById('btn-ask-ai').disabled = false;
        document.getElementById('ai-loading').style.display = 'none';
    });
}

// Modals
function openModal(id) {
    document.getElementById(id).classList.add('active');
    document.body.style.overflow = 'hidden'; // Prevent background scrolling
}

function closeModal(id) {
    document.getElementById(id).classList.remove('active');
    document.body.style.overflow = '';
}

function openReservationModal(id, name) {
    document.getElementById('res-restaurant-id').value = id;
    document.getElementById('res-restaurant-name').innerText = name;
    document.getElementById('reservationForm').reset();
    openModal('reservationModal');
}

function openReviewModal(id, name) {
    document.getElementById('rev-restaurant-id').value = id;
    document.getElementById('rev-restaurant-name').innerText = name + ' 어떠셨나요?';
    document.getElementById('reviewForm').reset();
    document.getElementById('rev-rating').value = '';
    document.querySelectorAll('.star').forEach(s => s.classList.remove('selected'));
    openModal('writeReviewModal');
}

async function openDetailsModal(id, name) {
    currentRestaurantId = id;
    document.getElementById('det-restaurant-name').innerText = name;
    
    const list = document.getElementById('reviewsList');
    list.innerHTML = '<div class="loading-spinner"></div>';
    
    openModal('detailsModal');
    
    let reviews = [];
    if (useLocalStorage) {
        reviews = JSON.parse(localStorage.getItem('reviews') || '[]');
    } else {
        try {
            const res = await fetch('/api/reviews');
            if(res.ok) reviews = await res.json();
            else reviews = JSON.parse(localStorage.getItem('reviews') || '[]');
        } catch(e) {
            reviews = JSON.parse(localStorage.getItem('reviews') || '[]');
        }
    }
    
    const targetReviews = reviews.filter(r => String(r.restaurantId) === String(id));
    
    if (targetReviews.length === 0) {
        document.getElementById('det-avg-rating').innerText = '0.0';
        document.getElementById('det-review-count').innerText = '(0개의 리뷰)';
        list.innerHTML = '<div class="no-reviews">아직 작성된 리뷰가 없습니다. 첫 리뷰를 남겨보세요!</div>';
        return;
    }
    
    const avg = targetReviews.reduce((sum, r) => sum + parseInt(r.rating), 0) / targetReviews.length;
    document.getElementById('det-avg-rating').innerText = avg.toFixed(1);
    document.getElementById('det-review-count').innerText = `(${targetReviews.length}개의 리뷰)`;
    
    list.innerHTML = '';
    targetReviews.forEach(r => {
        const item = document.createElement('div');
        item.className = 'review-item';
        // handle both html string and json response correctly
        const text = r.reviewText ? r.reviewText.replace(/\\n/g, '<br>').replace(/\n/g, '<br>') : '';
        item.innerHTML = `
            <div class="review-stars">${'★'.repeat(parseInt(r.rating))}${'☆'.repeat(5 - parseInt(r.rating))}</div>
            <div class="review-text">${text}</div>
        `;
        list.appendChild(item);
    });
}

// Submissions
async function handleReservationSubmit(e) {
    e.preventDefault();
    const data = {
        id: Date.now(),
        restaurantId: document.getElementById('res-restaurant-id').value,
        name: document.getElementById('res-name').value,
        contact: document.getElementById('res-contact').value,
        people: document.getElementById('res-people').value,
        time: document.getElementById('res-time').value
    };
    
    if (useLocalStorage) {
        const reservations = JSON.parse(localStorage.getItem('reservations') || '[]');
        reservations.push(data);
        localStorage.setItem('reservations', JSON.stringify(reservations));
        finishReservation();
    } else {
        try {
            const res = await fetch('/api/reservations', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            if(res.ok) finishReservation();
            else throw new Error('API Error');
        } catch(err) {
            // Fallback
            const reservations = JSON.parse(localStorage.getItem('reservations') || '[]');
            reservations.push(data);
            localStorage.setItem('reservations', JSON.stringify(reservations));
            finishReservation();
        }
    }
}

function finishReservation() {
    closeModal('reservationModal');
    showToast('예약이 성공적으로 완료되었습니다! 🎉');
    loadReservations();
}

async function handleReviewSubmit(e) {
    e.preventDefault();
    const rating = document.getElementById('rev-rating').value;
    
    if (!rating) {
        alert("별점을 선택해주세요!");
        return;
    }
    
    const data = {
        id: Date.now(),
        restaurantId: document.getElementById('rev-restaurant-id').value,
        rating: rating,
        reviewText: document.getElementById('rev-text').value
    };
    
    if (useLocalStorage) {
        const reviews = JSON.parse(localStorage.getItem('reviews') || '[]');
        reviews.push(data);
        localStorage.setItem('reviews', JSON.stringify(reviews));
        finishReview();
    } else {
        try {
            const res = await fetch('/api/reviews', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            if(res.ok) finishReview();
            else throw new Error('API Error');
        } catch(err) {
            const reviews = JSON.parse(localStorage.getItem('reviews') || '[]');
            reviews.push(data);
            localStorage.setItem('reviews', JSON.stringify(reviews));
            finishReview();
        }
    }
}

function finishReview() {
    closeModal('writeReviewModal');
    showToast('소중한 리뷰가 등록되었습니다! ⭐');
}

// Toast
function showToast(message) {
    const toast = document.getElementById('toast');
    toast.innerText = message;
    toast.classList.add('show');
    
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}
