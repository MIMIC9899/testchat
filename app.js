
const firebaseConfig = {
    apiKey: "AIzaSyCOsNLLxNDckFUIXOfOaMphlr6WlSRBxqA",
    authDomain: "chatonline-42b5a.firebaseapp.com",
    projectId: "chatonline-42b5a",
    storageBucket: "chatonline-42b5a.firebasestorage.app",
    messagingSenderId: "823959172627",
    appId: "1:823959172627:web:76ad14c35304661fac71e6",
    measurementId: "G-7LT3965R88"
  };
// Инициализация Firebase
const app = firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

let currentUser = null;
let isLoading = false;

function checkAuth() {
    if (!currentUser || !currentUser.uid) {
      throw new Error('Пользователь не авторизован');
    }
  }

async function withLoading(fn) {
  if (isLoading) return;
  isLoading = true;
  document.body.classList.add('cursor-wait');
  try {
    return await fn();
  } finally {
    isLoading = false;
    document.body.classList.remove('cursor-wait');
  }
}

// Проверка аутентификации
auth.onAuthStateChanged(user => {
    currentUser = user;
    if (user) {
        showSection('feed');
    } else {
        showAuthForm();
    }
});

// Навигация
function showSection(section) {
    const content = document.getElementById('content');
    content.innerHTML = '';

    switch(section) {
        case 'feed':
            loadFeed();
            break;
        case 'profile':
            loadProfile(currentUser.uid);
            break;
        case 'search':
            showSearch();
            break;
        case 'chats':
            loadChats();
            break;
        case 'settings':
            showSettings();
            break;
    }
}

// Регистрация
async function register(email, password, username) {
    try {
        const { user } = await auth.createUserWithEmailAndPassword(email, password);
        await db.collection('users').doc(user.uid).set({
          username,
          email,
          uid: user.uid, // Добавляем поле uid
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
    } catch (error) {
        alert(error.message);
    }
}

// Авторизация
async function login(email, password) {
    try {
        await auth.signInWithEmailAndPassword(email, password);
    } catch (error) {
        alert(error.message);
    }
}

async function loadProfile(uid) {
  try {
    checkAuth();
    showLoader();

    const [userDoc, postsSnapshot] = await Promise.all([
      db.collection('users').doc(uid).get(),
      db.collection('posts')
        .where('author', '==', uid)
        .orderBy('timestamp', 'desc')
        .get()
    ]);

    if (!userDoc.exists) throw new Error('Пользователь не найден');
    const userData = userDoc.data();

    const html = `
      <div class="bg-white p-6 rounded-lg shadow">
        <div class="flex items-center gap-4 mb-6">
          <div class="w-16 h-16 bg-blue-500 rounded-full flex items-center justify-center text-white text-2xl">
            ${userData.username[0]}
          </div>
          <h2 class="text-2xl font-bold">${userData.username}</h2>
        </div>
        
        ${uid === currentUser.uid ? `
          <form onsubmit="addPost(event)" class="mb-8">
            <textarea 
              id="postText"
              class="w-full p-2 border rounded mb-2"
              placeholder="Что у вас нового?"
              required
            ></textarea>
            <button 
              type="submit"
              class="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
            >
              Опубликовать
            </button>
          </form>
        ` : ''}

        <div class="space-y-4">
          ${postsSnapshot.docs.map(postDoc => {
            const postData = postDoc.data();
            return `
              <div class="bg-gray-50 p-4 rounded">
                <p class="text-gray-800">${postData.text}</p>
                ${postData.timestamp?.toDate() ? `
                  <small class="text-gray-500">
                    ${postData.timestamp.toDate().toLocaleString()}
                  </small>
                ` : ''}
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;

    const content = document.getElementById('content');
    if (content) {
      content.innerHTML = html;
    }
    
  } catch (error) {
    alert('Ошибка загрузки профиля: ' + error.message);
    showSection('feed');
  }
}

// Чат
async function loadChats() {
  try {
    showLoader();
    const chatsSnapshot = await db.collection('chats')
      .where('participants', 'array-contains', currentUser.uid)
      .get();

    const chats = await Promise.all(
      chatsSnapshot.docs.map(async (chatDoc) => {
        const participants = chatDoc.data().participants;
        const targetUserId = participants.find(id => id !== currentUser.uid);
        const userDoc = await db.collection('users').doc(targetUserId).get();
        return {
          id: chatDoc.id,
          username: userDoc.data()?.username || 'Неизвестный',
          lastMessage: chatDoc.data().lastMessage
        };
      })
    );

    const html = `
      <div class="space-y-4">
        ${chats.map(chat => `
          <div onclick="openChat('${chat.id}')" 
               class="bg-white p-4 rounded-lg shadow cursor-pointer hover:bg-gray-50 transition">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-3">
                <div class="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center text-white">
                  ${chat.username[0]}
                </div>
                <h3 class="text-lg font-semibold">${chat.username}</h3>
              </div>
              ${chat.lastMessage?.text ? `
                <div class="text-gray-600 max-w-[200px] truncate">
                  ${chat.lastMessage.text}
                </div>
              ` : ''}
            </div>
          </div>
        `).join('')}
      </div>
    `;

    document.getElementById('content').innerHTML = html;
  } catch (error) {
    alert('Ошибка загрузки чатов: ' + error.message);
  }
}

// Поиск пользователей
async function searchUsers(username) {
  const snapshot = await db.collection('users')
    .where('username', '>=', username)
    .where('username', '<=', username + '\uf8ff')
    .get();

  return snapshot.docs;
}

// Настройки
function showSettings() {
    const html = `
        <form onsubmit="updateProfile(event)">
            <input type="text" id="username" placeholder="Новое имя">
            <button type="submit">Обновить</button>
        </form>
        <form onsubmit="changePassword(event)">
            <input type="password" id="newPassword">
            <button type="submit">Сменить пароль</button>
        </form>
    `;
    
    document.getElementById('content').innerHTML = html;
}

// Функция показа формы авторизации
function showAuthForm() {
    const html = `
      <div class="max-w-md mx-auto bg-white rounded-lg shadow-md p-8 mt-20 fade-enter-active">
        <div class="text-center mb-8">
          <h1 class="text-3xl font-bold text-gray-800">Добро пожаловать!</h1>
          <p class="text-gray-500">Выберите действие</p>
        </div>
        
        <div class="space-y-6">
          <div class="bg-blue-50 p-6 rounded-lg">
            <h2 class="text-xl font-semibold mb-4">Вход</h2>
            <form onsubmit="handleLogin(event)" class="space-y-4">
              <input type="email" placeholder="Email" 
                class="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                id="loginEmail" required>
              <input type="password" placeholder="Пароль" 
                class="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                id="loginPassword" required>
              <button type="submit" 
                class="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition">
                Войти
              </button>
            </form>
          </div>
  
          <div class="bg-green-50 p-6 rounded-lg">
            <h2 class="text-xl font-semibold mb-4">Регистрация</h2>
            <form onsubmit="handleRegister(event)" class="space-y-4">
              <input type="text" placeholder="Имя пользователя" 
                class="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                id="registerUsername" required>
              <input type="email" placeholder="Email" 
                class="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                id="registerEmail" required>
              <input type="password" placeholder="Пароль" 
                class="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                id="registerPassword" required>
              <button type="submit" 
                class="w-full bg-green-600 text-white py-2 rounded-lg hover:bg-green-700 transition">
                Зарегистрироваться
              </button>
            </form>
          </div>
        </div>
      </div>
    `;
    document.getElementById('content').innerHTML = html;
  }
  
  // Обработчики форм
  function handleLogin(event) {
    event.preventDefault();
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    login(email, password);
  }
  
  function handleRegister(event) {
    event.preventDefault();
    const email = document.getElementById('registerEmail').value;
    const password = document.getElementById('registerPassword').value;
    const username = document.getElementById('registerUsername').value;
    register(email, password, username);
  }

  function showLoader() {
    document.getElementById('content').innerHTML = `
      <div class="text-center py-20">
        <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
      </div>
    `;
  }

  // Реализация функции добавления поста
  async function addPost(event) {
    event.preventDefault();
    const text = document.getElementById('postText').value;
    
    try {
      await db.collection('posts').add({
        text: text,
        author: currentUser.uid,
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
      });
      document.getElementById('postText').value = '';
      loadProfile(currentUser.uid); // Обновляем список постов
    } catch (error) {
      alert('Ошибка при публикации: ' + error.message);
    }
  }
  
  // Функция для ленты
  async function loadFeed() {
    try {
      showLoader();
      
      const postsSnapshot = await db.collection('posts')
        .orderBy('timestamp', 'desc')
        .limit(20)
        .get();
  
      const postsWithAuthors = await Promise.all(
        postsSnapshot.docs.map(async postDoc => {
          const postData = postDoc.data();
          const authorDoc = await db.collection('users').doc(postData.author).get();
          return {
            ...postData,
            id: postDoc.id,
            authorName: authorDoc.data()?.username || 'Аноним',
            authorId: postData.author
          };
        })
      );
  
      const html = `
        <div class="space-y-4">
          ${postsWithAuthors.map(post => `
            <div class="bg-white p-4 rounded-lg shadow">
              <div class="flex items-center gap-2 mb-2">
                <div 
                  class="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white cursor-pointer"
                  onclick="loadProfile('${post.authorId}')"
                >
                  ${post.authorName[0]}
                </div>
                <h4 
                  class="font-semibold cursor-pointer hover:text-blue-600"
                  onclick="loadProfile('${post.authorId}')"
                >
                  ${post.authorName}
                </h4>
              </div>
              <p class="text-gray-800">${post.text}</p>
              ${post.timestamp?.toDate() ? `
                <small class="text-gray-500 block mt-2">
                  ${post.timestamp.toDate().toLocaleString()}
                </small>
              ` : ''}
            </div>
          `).join('')}
        </div>
      `;
  
      const content = document.getElementById('content');
      if (content) {
        content.innerHTML = html;
      }
      
    } catch (error) {
      alert('Ошибка загрузки ленты: ' + error.message);
    }
  }
  
  // Вспомогательная функция получения имени пользователя
  async function getUsername(uid) {
    try {
      if (!uid) return 'Аноним';
      const doc = await db.collection('users').doc(uid).get();
      return doc.exists ? doc.data().username : 'Аноним';
    } catch (error) {
      console.error('Ошибка получения имени:', error);
      return 'Аноним';
    }
  }
  
  // Функция поиска пользователей
  async function showSearch() {
    return withLoading(async () => {
    const html = `
      <form onsubmit="handleSearch(event)">
        <input type="text" id="searchInput" placeholder="Введите имя пользователя">
        <button type="submit">Поиск</button>
      </form>
      <div id="searchResults"></div>
    `;
    document.getElementById('content').innerHTML = html;
});
  }
  
  
  async function handleSearch(event) {
    event.preventDefault();
    const username = document.getElementById('searchInput').value;
    const users = await searchUsers(username);
    
    const results = document.getElementById('searchResults');
    results.innerHTML = users.map(user => `
      <div class="bg-white p-4 rounded-lg shadow-sm mb-3 flex items-center justify-between">
        <div class="flex items-center space-x-3">
          <div class="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white">
            ${user.data().username?.[0] || '?'}
          </div>
          <span class="font-medium">${user.data().username || 'Неизвестный пользователь'}</span>
        </div>
        <button onclick="startChat('${user.id}')" 
          class="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition">
          Написать
        </button>
      </div>
    `).join('');
  }
  // Создание нового чата
  async function startChat(targetUserId) {
    try {
      checkAuth();
      showLoader();
  
      const currentUserId = currentUser.uid;
      
      // Проверка существующего чата
      const query = await db.collection('chats')
        .where('participants', 'array-contains', currentUserId)
        .get();
  
      const existingChat = query.docs.find(doc => 
        doc.data().participants.includes(targetUserId)
      );
  
      if (existingChat) {
        return openChat(existingChat.id);
      }
  
      // Создание нового чата
      const chatRef = await db.collection('chats').add({
        participants: [currentUserId, targetUserId],
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        messages: [],
        lastMessage: null
      });
  
      openChat(chatRef.id);
  
    } catch (error) {
      alert('Ошибка создания чата: ' + error.message);
      showSection('search');
    }
  }

// Обновлённый openChat с реальными обновлениями
async function openChat(chatId) {
  try {
    showLoader();
    
    const html = `
      <div class="bg-white rounded-lg shadow-md p-6 h-[600px] flex flex-col">
        <div class="border-b pb-4 mb-4 flex items-center space-x-3" id="chatHeader">
          <div class="loading-spinner"></div>
        </div>
        
        <div 
          class="flex-1 overflow-y-auto space-y-4 mb-6" 
          id="messagesContainer"
          style="max-height: 400px"
        ></div>
        
        <form onsubmit="sendMessage(event, '${chatId}')" class="flex gap-2">
          <input 
            type="text" 
            id="messageInput" 
            class="flex-1 px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
            placeholder="Напишите сообщение..."
          >
          <button 
            type="submit" 
            class="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition"
          >
            Отправить
          </button>
        </form>
      </div>
    `;
    
    document.getElementById('content').innerHTML = html;

    const chatRef = db.collection('chats').doc(chatId);
    const messagesRef = chatRef.collection('messages').orderBy('timestamp', 'asc');
    const container = document.getElementById('messagesContainer');
    const header = document.getElementById('chatHeader');

    // Загрузка информации о собеседнике
    const chatDoc = await chatRef.get();
    const participants = chatDoc.data().participants;
    const targetUserId = participants.find(id => id !== currentUser.uid);
    const targetUserDoc = await db.collection('users').doc(targetUserId).get();
    const targetUser = targetUserDoc.data();

    header.innerHTML = `
      <div class="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center text-white">
        ${targetUser.username[0]}
      </div>
      <h3 class="text-xl font-semibold">${targetUser.username}</h3>
    `;

    // Подписка на сообщения в реальном времени
    const unsubscribe = messagesRef.onSnapshot(async (snapshot) => {
      const messages = await Promise.all(
        snapshot.docs.map(async doc => {
          const message = doc.data();
          const userDoc = await db.collection('users').doc(message.sender).get();
          return {
            ...message,
            username: userDoc.data().username
          };
        })
      );

      container.innerHTML = messages.map(msg => `
        <div class="chat-message ${msg.sender === currentUser.uid ? 'my' : 'other'} 
          p-4 rounded-lg max-w-[70%] w-fit">
          <div class="text-sm font-medium text-gray-600 mb-1">
            ${msg.username}
          </div>
          <p class="text-gray-800">${msg.text}</p>
          <span class="text-xs text-gray-500 mt-1 block">
            ${msg.timestamp?.toDate()?.toLocaleTimeString() || ''}
          </span>
        </div>
      `).join('');

      container.scrollTop = container.scrollHeight;
    });

    window.addEventListener('beforeunload', unsubscribe);
    
  } catch (error) {
    alert('Ошибка открытия чата: ' + error.message);
    showSection('chats');
  }
}

  // Отправка сообщения
  async function sendMessage(event, chatId) {
    event.preventDefault();
    const input = document.getElementById('messageInput');
    const text = input.value.trim();
  
    if (!text) return;
  
    try {
      // Добавляем сообщение в подколлекцию messages
      const messagesRef = db.collection('chats').doc(chatId).collection('messages');
      await messagesRef.add({
        text: text,
        sender: currentUser.uid,
        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
        read: false
      });
  
      // Обновляем последнее сообщение в основном документе чата
      await db.collection('chats').doc(chatId).update({
        lastMessage: {
          text: text,
          sender: currentUser.uid,
          timestamp: firebase.firestore.FieldValue.serverTimestamp()
        }
      });
  
      input.value = '';
    } catch (error) {
      console.error('Ошибка отправки сообщения:', error);
      alert('Ошибка отправки: ' + error.message);
    }
  }

  // Функции настроек
  async function updateProfile(event) {
    return withLoading(async () => {
    event.preventDefault();
    const newUsername = document.getElementById('username').value;
    
    try {
      await db.collection('users').doc(currentUser.uid).update({
        username: newUsername
      });
      alert('Имя обновлено!');
      loadProfile(currentUser.uid);
    } catch (error) {
      alert('Ошибка: ' + error.message);
    }
});
  }
  
  async function changePassword(event) {
    return withLoading(async () => {
    event.preventDefault();
    const newPassword = document.getElementById('newPassword').value;
    
    try {
      await currentUser.updatePassword(newPassword);
      alert('Пароль успешно изменен!');
    } catch (error) {
      alert('Ошибка: ' + error.message);
    }
});
  }
  
  // Выход
  function logout() {
    auth.signOut();
  }