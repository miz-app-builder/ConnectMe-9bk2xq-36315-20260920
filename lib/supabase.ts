import AsyncStorage from "@react-native-async-storage/async-storage";
import {createClient} from "@supabase/supabase-js";
import Config from "react-native-config";
const url=Config.SUPABASE_URL;
const key=Config.SUPABASE_ANON_KEY;
export const supabaseConfigured=Boolean(url&&key);
export const supabase=supabaseConfigured?createClient(url!,key!,{auth:{storage:AsyncStorage,autoRefreshToken:true,persistSession:true,detectSessionInUrl:false}}):null;
export function requireSupabase(){if(!supabase)throw new Error("Supabase backend is not configured.");return supabase}
