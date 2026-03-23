// ============================================
// اختبار شامل للتطبيق
// ============================================

// 1. اختبار تحميل Supabase
console.log('1. Supabase client:', supabase ? '✅ موجود' : '❌ غير موجود');
console.log('2. Supabase URL:', https://qrgihwclvpuefnrswsnp.supabase.co);
console.log('3. Supabase Key:', sb_publishable_0QoBfzE-JgvKqurfSzF8uA_he3HIcW7 ? '✅ موجود' : '❌ غير موجود');
// عرض الأخطاء مباشرة على الشاشة (لرؤيتها على الجوال)
function showErrorOnScreen(message) {
    const errorDiv = document.createElement('div');
    errorDiv.style.cssText = `
        position: fixed;
        bottom: 10px;
        left: 10px;
        right: 10px;
        background: red;
        color: white;
        padding: 10px;
        border-radius: 10px;
        z-index: 9999;
        font-size: 12px;
        word-break: break-word;
    `;
    errorDiv.innerHTML = '❌ ' + message;
    document.body.appendChild(errorDiv);
    setTimeout(() => errorDiv.remove(), 10000);
}

// اختبار بسيط عند تحميل الصفحة
window.addEventListener('load', function() {
    setTimeout(async function() {
        try {
            const { data, error } = await supabase.from('users').select('count');
            if (error) {
                showErrorOnScreen('خطأ: ' + error.message);
            } else {
                showErrorOnScreen('✅ الاتصال بقاعدة البيانات ناجح!');
            }
        } catch(e) {
            showErrorOnScreen('فشل الاتصال: ' + e.message);
        }
    }, 2000);
});

// تعديل دالة login لإظهار الأخطاء
const originalLogin = login;
window.login = async function() {
    try {
        showErrorOnScreen('جاري تسجيل الدخول...');
        await originalLogin();
    } catch(e) {
        showErrorOnScreen('خطأ: ' + e.message);
    }
};
// 2. اختبار تسجيل الدخول يدوياً
window.testLogin = async function(username) {
    console.log('🔍 اختبار تسجيل الدخول لاسم:', username);
    
    // البحث عن المستخدم
    const { data: existingUser, error: findError } = await supabase
        .from('users')
        .select('*')
        .eq('username', username)
        .maybeSingle();
    
    if (findError) {
        console.error('❌ خطأ في البحث:', findError);
        return { success: false, error: findError };
    }
    
    if (existingUser) {
        console.log('✅ المستخدم موجود:', existingUser);
        return { success: true, user: existingUser, isNew: false };
    } else {
        console.log('📝 المستخدم غير موجود، سيتم إنشاؤه');
        // إنشاء مستخدم جديد
        const { data: newUser, error: insertError } = await supabase
            .from('users')
            .insert({ username: username, status: 'online' })
            .select()
            .single();
        
        if (insertError) {
            console.error('❌ خطأ في الإنشاء:', insertError);
            return { success: false, error: insertError };
        }
        
        console.log('✅ تم إنشاء المستخدم:', newUser);
        return { success: true, user: newUser, isNew: true };
    }
};

// 3. اختبار عرض رسائل الخطأ
window.addEventListener('error', function(e) {
    console.error('🔥 خطأ عام في التطبيق:', e.message, e.filename, e.lineno);
    alert('خطأ: ' + e.message);
});
// ============================================
// تطبيق مراسلات - مع Supabase
// يدعم الغرف العامة والمحادثات الخاصة
// ============================================

// ============================================
// Supabase Configuration - مباشر
// ============================================

// ⚠️ IMPORTANT: ضع بيانات Supabase هنا - انسخها من Project Settings → API
const SUPABASE_URL = 'https://qrgihwclvpuefnrswsnp.supabase.co';  // 👈 ضع رابط Supabase هنا
const SUPABASE_ANON_KEY = 'sb_publishable_0QoBfzE-JgvKqurfSzF8uA_he3HIcW7';  // 👈 ضع المفتاح العام هنا

// تهيئة Supabase client
const supabase = window.supabase?.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ============================================
// اختبار الاتصال - لمعرفة الخطأ
// ============================================
window.addEventListener('load', function() {
    console.log('✅ التطبيق جاهز');
    console.log('📡 Supabase URL:', SUPABASE_URL);
    console.log('🔑 Supabase Key:', SUPABASE_ANON_KEY ? 'موجود ✓' : 'غير موجود ✗');
    
    if (!supabase) {
        console.error('❌ Supabase client لم يتم تحميله');
        alert('خطأ: لم يتم تحميل Supabase. تأكد من اتصال الإنترنت');
        return;
    }
    
    // اختبار قراءة المستخدمين
    supabase.from('users').select('count').then(result => {
        console.log('✅ اتصال Supabase ناجح!', result);
        if (result.error) {
            console.error('❌ خطأ في القراءة:', result.error);
            alert('خطأ في قاعدة البيانات: ' + result.error.message);
        } else {
            console.log('📊 عدد المستخدمين:', result.data?.[0]?.count || 0);
        }
    }).catch(error => {
        console.error('❌ فشل الاتصال بـ Supabase:', error);
        alert('خطأ في الاتصال بـ Supabase: ' + error.message);
    });
});

// ---------- المتغيرات العامة ----------
let currentUser = null;
let currentUserId = null;
let peerConnections = {};
let onlineUsers = [];
let publicChannel = null;
let usersChannel = null;

// ---------- واجهة المستخدم ----------
function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(screenId).classList.add('active');
}

function showNotification(message, duration = 3000) {
    const notif = document.getElementById('notification');
    notif.textContent = message;
    notif.classList.add('show');
    setTimeout(() => notif.classList.remove('show'), duration);
}

// ---------- تسجيل الدخول مع Supabase ----------
async function login() {
    const username = document.getElementById('username').value.trim();
    if (!username) {
        showNotification('الرجاء إدخال اسم المستخدم');
        return;
    }
    
    // منع الأسماء القصيرة
    if (username.length < 3) {
        showNotification('اسم المستخدم يجب أن يكون 3 أحرف على الأقل');
        return;
    }
    
    try {
        showNotification('جاري تسجيل الدخول...');
        console.log('🔐 محاولة تسجيل الدخول باسم:', username);
        
        // البحث عن المستخدم أو إنشاؤه
        let { data: existingUser, error: findError } = await supabase
            .from('users')
            .select('*')
            .eq('username', username)
            .maybeSingle();
        
        if (findError) {
            console.error('❌ خطأ في البحث عن المستخدم:', findError);
            throw findError;
        }
        
        if (existingUser) {
            // مستخدم موجود - تحديث الحالة
            currentUserId = existingUser.id;
            currentUser = existingUser.username;
            
            const { error: updateError } = await supabase
                .from('users')
                .update({ status: 'online', last_seen: new Date().toISOString() })
                .eq('id', currentUserId);
            
            if (updateError) {
                console.error('❌ خطأ في تحديث الحالة:', updateError);
            }
            
            console.log('✅ مرحباً بعودتك:', currentUser);
            showNotification(`مرحباً بعودتك ${currentUser}!`);
        } else {
            // مستخدم جديد - إنشاء
            console.log('📝 إنشاء مستخدم جديد:', username);
            const { data: newUser, error: insertError } = await supabase
                .from('users')
                .insert({ 
                    username: username, 
                    status: 'online',
                    last_seen: new Date().toISOString()
                })
                .select()
                .single();
            
            if (insertError) {
                console.error('❌ خطأ في إنشاء المستخدم:', insertError);
                throw insertError;
            }
            
            currentUserId = newUser.id;
            currentUser = newUser.username;
            console.log('✅ تم إنشاء المستخدم:', currentUser);
            showNotification(`✨ مرحباً ${currentUser}! حسابك الجديد جاهز`);
        }
        
        // تحديث الواجهة
        document.getElementById('currentUser').textContent = currentUser;
        
        // بدء الجلسة
        await initApp();
        showScreen('chatScreen');
        console.log('✅ تم تسجيل الدخول بنجاح');
        
    } catch (error) {
        console.error('❌ خطأ في تسجيل الدخول:', error);
        showNotification('خطأ في تسجيل الدخول: ' + error.message);
    }
}

// ---------- تسجيل الخروج ----------
async function logout() {
    if (confirm('هل تريد تسجيل الخروج؟')) {
        showNotification('جاري تسجيل الخروج...');
        
        // تحديث حالة المستخدم
        if (currentUserId) {
            await supabase
                .from('users')
                .update({ status: 'offline', last_seen: new Date().toISOString() })
                .eq('id', currentUserId);
        }
        
        // تنظيف الاتصالات
        Object.values(peerConnections).forEach(conn => {
            if (conn) conn.close();
        });
        
        // إلغاء الاشتراك من القنوات
        if (publicChannel) {
            await supabase.removeChannel(publicChannel);
        }
        if (usersChannel) {
            await supabase.removeChannel(usersChannel);
        }
        
        currentUser = null;
        currentUserId = null;
        showScreen('loginScreen');
        document.getElementById('username').value = '';
        console.log('👋 تم تسجيل الخروج');
    }
}

// ---------- إرسال رسالة عامة ----------
async function sendPublicMessage() {
    const input = document.getElementById('publicInput');
    const text = input.value.trim();
    if (!text) return;
    
    try {
        const { error } = await supabase
            .from('public_messages')
            .insert({
                user_id: currentUserId,
                username: currentUser,
                content: text
            });
        
        if (error) throw error;
        
        input.value = '';
        console.log('📨 تم إرسال رسالة عامة');
        
    } catch (error) {
        console.error('❌ خطأ في إرسال الرسالة:', error);
        showNotification('خطأ في إرسال الرسالة');
    }
}

// ---------- تحميل الرسائل العامة ----------
async function loadPublicMessages() {
    const { data: messages, error } = await supabase
        .from('public_messages')
        .select('*')
        .order('created_at', { ascending: true })
        .limit(50);
    
    if (error) {
        console.error('❌ خطأ في تحميل الرسائل:', error);
        return;
    }
    
    const container = document.getElementById('publicMessages');
    container.innerHTML = '<div class="welcome-msg">✨ الغرفة العامة - الرسائل تظهر للجميع</div>';
    
    messages.forEach(msg => {
        addPublicMessage(
            msg.username, 
            msg.content, 
            msg.user_id === currentUserId ? 'sent' : 'received',
            msg.created_at
        );
    });
    console.log(`📥 تم تحميل ${messages.length} رسالة`);
}

// ---------- إضافة رسالة عامة للواجهة ----------
function addPublicMessage(sender, text, type, timestamp = null) {
    const container = document.getElementById('publicMessages');
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${type}`;
    
    let time;
    if (timestamp) {
        const date = new Date(timestamp);
        time = date.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
    } else {
        time = new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
    }
    
    messageDiv.innerHTML = `
        ${type === 'received' ? `<div class="message-sender">${escapeHtml(sender)}</div>` : ''}
        <div class="message-content">${escapeHtml(text)}</div>
        <div class="message-time">${time}</div>
    `;
    
    container.appendChild(messageDiv);
    container.scrollTop = container.scrollHeight;
}

function handlePublicKeyPress(event) {
    if (event.key === 'Enter') sendPublicMessage();
}

// ---------- تحديث قائمة المستخدمين المتصلين ----------
async function updateOnlineUsersList() {
    const { data: users, error } = await supabase
        .from('users')
        .select('id, username, status')
        .eq('status', 'online')
        .neq('id', currentUserId);
    
    if (error) {
        console.error('❌ خطأ في تحميل المستخدمين:', error);
        return;
    }
    
    const container = document.getElementById('onlineUsersList');
    const select = document.getElementById('onlineUsersSelect');
    
    if (!users || users.length === 0) {
        container.innerHTML = '<div class="info-msg">👤 لا يوجد مستخدمون متصلون حالياً</div>';
        select.innerHTML = '<option value="">-- لا يوجد مستخدمون متصلون --</option>';
        return;
    }
    
    container.innerHTML = users.map(user => `
        <div class="online-user" onclick="startPrivateChat('${user.username}')">
            <div class="name">
                <span class="status"></span>
                <span>${escapeHtml(user.username)}</span>
            </div>
            <button class="chat-btn" onclick="event.stopPropagation(); startPrivateChat('${user.username}')">💬 محادثة</button>
        </div>
    `).join('');
    
    select.innerHTML = '<option value="">-- اختر المستخدم للمحادثة الخاصة --</option>' + 
        users.map(user => `<option value="${user.username}" data-id="${user.id}">${escapeHtml(user.username)}</option>`).join('');
    
    onlineUsers = users;
    console.log(`👥 ${users.length} مستخدم متصل`);
}

// ---------- الاستماع للرسائل الجديدة (Realtime) ----------
async function subscribeToPublicMessages() {
    publicChannel = supabase
        .channel('public_messages_realtime')
        .on('postgres_changes', 
            { event: 'INSERT', schema: 'public', table: 'public_messages' },
            (payload) => {
                const newMsg = payload.new;
                if (newMsg.user_id !== currentUserId) {
                    addPublicMessage(newMsg.username, newMsg.content, 'received', newMsg.created_at);
                    showNotification(`📨 رسالة جديدة من ${newMsg.username}`);
                }
            }
        )
        .subscribe((status) => {
            if (status === 'SUBSCRIBED') {
                console.log('✅ جاري الاستماع للرسائل الجديدة');
            } else {
                console.log('📡 حالة الاشتراك:', status);
            }
        });
}

// ---------- الاستماع لتغيرات حالة المستخدمين ----------
async function subscribeToUsers() {
    usersChannel = supabase
        .channel('users_realtime')
        .on('postgres_changes',
            { event: '*', schema: 'public', table: 'users' },
            () => {
                updateOnlineUsersList();
            }
        )
        .subscribe();
}

// ---------- المحادثات الخاصة (P2P - قيد التطوير) ----------
async function startPrivateChat(userName) {
    const select = document.getElementById('onlineUsersSelect');
    select.value = userName;
    
    const user = onlineUsers.find(u => u.username === userName);
    if (!user) {
        showNotification('المستخدم غير متصل حالياً');
        return;
    }
    
    document.getElementById('privateChatStatus').innerHTML = `🔒 محادثة خاصة مع ${escapeHtml(userName)} (P2P قيد التطوير)`;
    document.getElementById('privateInput').disabled = false;
    document.getElementById('privateSendBtn').disabled = false;
    
    const container = document.getElementById('privateMessages');
    container.innerHTML = `
        <div class="info-msg">
            🔒 محادثة مشفرة مع ${escapeHtml(userName)}<br>
            📡 WebRTC P2P قيد التطوير
        </div>
    `;
    
    showNotification(`بدأت محادثة خاصة مع ${userName}`);
}

function sendPrivateMessage() {
    const input = document.getElementById('privateInput');
    const text = input.value.trim();
    const selectedUser = document.getElementById('onlineUsersSelect').value;
    
    if (!text || !selectedUser) {
        showNotification('اختر مستخدم أولاً');
        return;
    }
    
    addPrivateMessage(currentUser, text, 'sent');
    input.value = '';
    
    setTimeout(() => {
        addPrivateMessage(selectedUser, `(محاكاة) ${text.substring(0, 50)}`, 'received');
        showNotification(`🔒 رسالة خاصة من ${selectedUser}`);
    }, 800);
}

function addPrivateMessage(sender, text, type) {
    const container = document.getElementById('privateMessages');
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${type}`;
    
    const time = new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
    
    messageDiv.innerHTML = `
        <div class="message-sender">${escapeHtml(sender)}</div>
        <div class="message-content">${escapeHtml(text)}</div>
        <div class="message-time">${time}</div>
    `;
    
    container.appendChild(messageDiv);
    container.scrollTop = container.scrollHeight;
}

function handlePrivateKeyPress(event) {
    if (event.key === 'Enter') sendPrivateMessage();
}

function switchTab(tab) {
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');
    
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
    document.getElementById(`${tab}Tab`).classList.add('active');
    
    if (tab === 'online') {
        updateOnlineUsersList();
    }
}

// ---------- أدوات مساعدة ----------
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ---------- تهيئة التطبيق ----------
async function initApp() {
    await loadPublicMessages();
    await updateOnlineUsersList();
    await subscribeToPublicMessages();
    await subscribeToUsers();
    
    setInterval(updateOnlineUsersList, 30000);
    
    window.addEventListener('beforeunload', () => {
        if (currentUserId) {
            supabase
                .from('users')
                .update({ status: 'offline', last_seen: new Date().toISOString() })
                .eq('id', currentUserId);
        }
    });
    
    showNotification(`✨ مرحباً ${currentUser}! الدردشة العامة تعمل الآن`);
}
