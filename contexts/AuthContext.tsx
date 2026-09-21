import{createContext,useContext,useEffect,useState,ReactNode}from"react";import type{Session,User}from"@supabase/supabase-js";import{supabase,supabaseConfigured}from"@/lib/supabase";
type C={session:Session|null,user:User|null,loading:boolean,configured:boolean,signIn:(e:string,p:string)=>Promise<void>,signUp:(e:string,p:string)=>Promise<void>,signOut:()=>Promise<void>};
const Ctx=createContext<C>({session:null,user:null,loading:true,configured:false,signIn:async()=>{},signUp:async()=>{},signOut:async()=>{}});
export function AuthProvider({children}:{children:ReactNode}){const[session,setSession]=useState<Session|null>(null);const[loading,setLoading]=useState(true);
useEffect(()=>{if(!supabase){setLoading(false);return}supabase.auth.getSession().then(({data})=>{setSession(data.session);setLoading(false)});const{data:{subscription}}=supabase.auth.onAuthStateChange((_e,s)=>setSession(s));return()=>subscription.unsubscribe()},[]);
const signIn=async(e:string,p:string)=>{if(!supabase)throw new Error("Supabase backend is not configured.");const{error}=await supabase.auth.signInWithPassword({email:e,password:p});if(error)throw error};
const signUp=async(e:string,p:string)=>{if(!supabase)throw new Error("Supabase backend is not configured.");const{error}=await supabase.auth.signUp({email:e,password:p});if(error)throw error};
const signOut=async()=>{if(!supabase)return;const{error}=await supabase.auth.signOut();if(error)throw error};
return <Ctx.Provider value={{session,user:session?.user??null,loading,configured:supabaseConfigured,signIn,signUp,signOut}}>{children}</Ctx.Provider>}
export const useAuth=()=>useContext(Ctx);