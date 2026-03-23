// ============================================
// تطبيق مراسلات - مع Supabase
// يدعم الغرف العامة والمحادثات الخاصة
// ============================================

// ============================================
// Supabase Configuration - باستخدام متغيرات البيئة
// ============================================

// المتغيرات ستأتي من Vercel (Environment Variables)
// إذا كنت تعمل محلياً، استخدم القيم الافتراضية للتجربة
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://qrgihwclvpuefnrswsnp.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'sb_publishable_0QoBfzE-JgvKqurfSzF8uA_he3HIcW7';

// تنبيه للتطوير المحلي
if (!process.env.SUPABASE_URL && SUPABASE_URL === 'https://your-project.supabase.co') {
    console.warn('⚠️ تنبيه: يرجى إضافة SUPABASE_URL و SUPABASE_ANON_KEY في متغيرات البيئة');
    console.warn('⚠️ للتجربة المحلية: يمكنك تجاهل هذا التنبيه');
}

// تهيئة Supabase client
const supabase = window.supabase?.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// التحقق من تحميل Supabase
if (!supabase) {
    console.error('Supabase not loaded!');
    alert('خطأ: لم يتم تحميل Supabase. تأكد من اتصال الإنترنت');
}

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
        
        // البحث عن المستخدم أو إنشاؤه
        let { data: existingUser, error: findError } = await supabase
            .from('users')
            .select('*')
            .eq('username', username)
            .maybeSingle();
        
        if (findError && findError.code !== 'PGRST116') {
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
            
            if (updateError) console.error('Update error:', updateError);
            
            showNotification(`مرحباً بعودتك ${currentUser}!`);
        } else {
            // مستخدم جديد - إنشاء
            const { data: newUser, error: insertError } = await supabase
                .from('users')
                .insert({ 
                    username: username, 
                    status: 'online',
                    last_seen: new Date().toISOString()
                })
                .select()
                .single();
            
            if (insertError) throw insertError;
            
            currentUserId = newUser.id;
            currentUser = newUser.username;
            showNotification(`✨ مرحباً ${currentUser}! حسابك الجديد جاهز`);
        }
        
        // تحديث الواجهة
        document.getElementById('currentUser').textContent = currentUser;
        
        // بدء الجلسة
        await initApp();
        showScreen('chatScreen');
        
    } catch (error) {
        console.error('Login error:', error);
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
        
    } catch (error) {
        console.error('Send error:', error);
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
        console.error('Load messages error:', error);
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
        console.error('Load users error:', error);
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
}

// ---------- الاستماع للرسائل الجديدة (Realtime) ----------
async function subscribeToPublicMessages() {
    publicChannel = supabase
        .channel('public_messages_realtime')
        .on('postgres_changes', 
            { event: 'INSERT', schema: 'public', table: 'public_messages' },
            (payload) => {
                const newMsg = payload.new;
                // لا نضيف الرسالة إذا كانت من المستخدم الحالي (أضفناها بالفعل)
                if (newMsg.user_id !== currentUserId) {
                    addPublicMessage(newMsg.username, newMsg.content, 'received', newMsg.created_at);
                    showNotification(`📨 رسالة جديدة من ${newMsg.username}`);
                }
            }
        )
        .subscribe((status) => {
            if (status === 'SUBSCRIBED') {
                console.log('✅ جاري الاستماع للرسائل الجديدة');
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
    
    // البحث عن user ID
    const user = onlineUsers.find(u => u.username === userName);
    if (!user) {
        showNotification('المستخدم غير متصل حالياً');
        return;
    }
    
    document.getElementById('privateChatStatus').innerHTML = `🔒 محادثة خاصة مع ${escapeHtml(userName)} (P2P قيد التطوير)`;
    document.getElementById('privateInput').disabled = false;
    document.getElementById('privateSendBtn').disabled = false;
    
    // تنظيف المحادثة السابقة
    const container = document.getElementById('privateMessages');
    container.innerHTML = `
        <div class="info-msg">
            🔒 محادثة مشفرة مع ${escapeHtml(userName)}<br>
            📡 WebRTC P2P قيد التطوير - حالياً الرسائل محاكاة محلية
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
    
    // محاكاة الرد (سيتم استبدالها بـ WebRTC لاحقاً)
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
    // تحديث الأزرار
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');
    
    // تحديث المحتوى
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
    document.getElementById(`${tab}Tab`).classList.add('active');
    
    // تحديث القوائم حسب التبويب
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
    // تحميل الرسائل السابقة
    await loadPublicMessages();
    
    // تحديث قائمة المستخدمين
    await updateOnlineUsersList();
    
    // الاشتراك في الرسائل الجديدة
    await subscribeToPublicMessages();
    
    // الاشتراك في تغيرات المستخدمين
    await subscribeToUsers();
    
    // تحديث قائمة المستخدمين كل 30 ثانية
    setInterval(updateOnlineUsersList, 30000);
    
    // تنظيف عند إغلاق الصفحة
    window.addEventListener('beforeunload', () => {
        if (currentUserId) {
            supabase
                .from('users')
                .update({ status: 'offline', last_seen: new Date().toISOString() })
                .eq('id', currentUserId);
        }
    });
    
    showNotification(`✨ مرحباً ${currentUser}! الدردشة العامة تعمل الآن مع الجميع`);
}
