import { useEffect, useRef, useState } from "react";
import io from "socket.io-client";

export default function Chat(){

    const socket = useRef();
    const [me , setMe]= useState('');
    const [onlineUsers, setOnlineUsers]= useState([]);
    const [inMesg, setInMesg]=useState([]);
    const [outMesg, setOutMesg] = useState('');
    const [friendId, setFriendId]= useState('');
    const BASE_API=import.meta.env.VITE_API_BASE_URL;
    const [selectedUser, setSelectedUser] = useState(null);
    const [unread, setUnread] = useState([]);
    const scrollRef = useRef();
    const username = localStorage.getItem('username')

    useEffect(()=>{

        socket.current= io.connect(BASE_API,{
            auth:{
                username
            }
        });
        socket.current.on('me', (id)=>setMe(id));
        socket.current.on('updateUserList', (users)=>{
            // console.log(socket.current.id);
            // setOnlineUsers(users);
            const online= users.filter(u=> u !== socket.current.id);
            setOnlineUsers(online);
        });
        socket.current.on('incoming', (incoming)=>{
            console.log(incoming);
            setInMesg(prev => [...prev, incoming]);
            // If the sender is NOT the person I'm currently talking to, mark as unread
            setSelectedUser(current => {
                if (incoming.mine !== current) {
                    setUnread(prev => [...new Set([...prev, incoming.mine])]); // Use Set to avoid duplicates
                }
                return current;
            });            
        });
        return ()=> socket.current.disconnect();

    },[])

    useEffect(() => {
        // Use a tiny timeout or ensure the ref exists
        if (scrollRef.current) {
          scrollRef.current.scrollIntoView({ 
            behavior: "smooth", 
            block: "end" 
          });
        }
      }, [inMesg, selectedUser]); // Trigger on new message OR when switching users    

    const handleUserClick = (userId) => {
        setSelectedUser(userId);
        // Remove this user from the unread array
        setUnread(prev => prev.filter(id => id !== userId));
    };    

    const sendMessage= (mine, fid) =>{
        console.log(mine, fid, outMesg);        
        setFriendId(fid);
        const messageData = { mine, fid, outMesg };        
        socket.current.emit('outgoing',messageData);
        setInMesg(prev => [...prev, messageData]);
        setOutMesg('');
    }

    return (
        <div className="flex h-screen bg-gray-100 font-sans overflow-hidden">
          {/* SIDEBAR: List of Users */}
          <div className="w-1/3 bg-white border-r border-gray-200 flex flex-col">
            <div className="p-6 border-b bg-gray-900 text-white">
              <h1 className="text-xl font-bold">Messages</h1>
              <p className="text-xs opacity-80">Logged in as: {me}</p>
            </div>
            <div className="overflow-y-auto flex-1">
                {onlineUsers.map((user) => {
                    const isUnread = unread.includes(user);
                    return (
                        <div key={user} onClick={() => handleUserClick(user)}
                            className={`p-4 border-b cursor-pointer flex justify-between items-center transition-all ${
                                selectedUser === user ? "bg-indigo-50 border-r-4 border-r-indigo-500" : "hover:bg-gray-50"
                            } ${isUnread ? "bg-blue-50" : ""}`} // Light blue background if unread
                        >
                            <div className="flex flex-col">
                                <span className={`text-sm ${isUnread ? "font-black text-gray-900" : "text-gray-600"}`}>
                                    {user}
                                </span>
                                <span className="text-[10px] text-green-500 font-bold tracking-tight">● ONLINE</span>
                            </div>

                            {isUnread && (
                                <div className="flex flex-col items-end gap-1">
                                    <span className="bg-gray-900 text-white text-[10px] px-2 py-0.5 rounded-full font-bold animate-bounce">
                                        NEW
                                    </span>
                                    <div className="w-2 h-2 bg-gray-900 rounded-full animate-ping"></div>
                                </div>
                            )}
                        </div>
                    );
                })}

                {onlineUsers.length === 0 && <p className="p-4 text-gray-400 text-center text-sm">No one else is here...</p>}
            </div>
          </div>
    
          {/* MAIN CHAT WINDOW */}
          <div className="w-2/3 flex flex-col">
            {selectedUser ? (
              <>
                {/* Chat Header */}
                <div className="p-4 bg-white border-b shadow-sm flex items-center justify-between">
                  <span className="font-bold text-gray-700">Chatting with {selectedUser.substring(0, 10)}...</span>
                  <button onClick={() => setSelectedUser(null)} className="text-gray-400 hover:text-red-500 text-sm">Close</button>
                </div>
    
                {/* Message List */}
                <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-[#e5ddd5]">
                  {inMesg
                    .filter((m) => (m.mine === me && m.fid === selectedUser) || (m.mine === selectedUser && m.fid === me))
                    .map((m, index) => (
                      <div key={index} className={`flex ${m.mine === me ? "justify-end" : "justify-start"}`}>
                        <div
                          className={`max-w-xs px-4 py-2 rounded-2xl shadow-sm text-sm ${
                            m.mine === me ? "bg-gray-900 text-white rounded-tr-none" : "bg-green-900 text-white rounded-tl-none"
                          }`}
                        >
                          {m.outMesg}
                        </div>
                      </div>
                    ))}
                    {/* THIS DIV ACTS AS AN ANCHOR FOR SCROLLING */}
                    <div ref={scrollRef} />
                </div>
    
                {/* Input Area */}
                <div className="p-4 bg-white border-t flex gap-2 items-center">
                  <textarea
                    value={outMesg}
                    onChange={(e) => setOutMesg(e.target.value)}
                    onKeyDown={(e)=>{
                    if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        sendMessage(me, selectedUser)
                        }                                        
                    }}                    
                    placeholder="Type a message..."
                    className="flex-1 bg-gray-100 border-none rounded-2xl px-4 py-2 focus:ring-2 focus:ring-indigo-500 outline-none resize-none h-12"
                  />
                  <button
                    onClick={()=>sendMessage(me, selectedUser)}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white p-3 rounded-full transition-all active:scale-90"
                  >
                    <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
                      <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"></path>
                    </svg>
                  </button>
                </div>
              </>
            ) : (
              <div className="flex-1 flex flex-center items-center justify-center text-gray-400 flex-col">
                <div className="text-6xl mb-4">💬</div>
                <p>Select a user to start chatting</p>
              </div>
            )}
          </div>
        </div>
      );    
}