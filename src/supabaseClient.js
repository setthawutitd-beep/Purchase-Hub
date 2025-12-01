import { createClient } from '@supabase/supabase-js'

// 1. ไปที่ Supabase > Settings (รูปเฟือง) > API
// 2. ก๊อปปี้ Project URL มาใส่ในเครื่องหมายคำพูดอันแรก
const supabaseUrl = 'https://jymnwdfflnlatxkbnvhr.supabase.co' 

// 3. ก๊อปปี้ Project API Key (anon public) มาใส่ในเครื่องหมายคำพูดอันที่สอง
const supabaseKey = 'sb_publishable_UuA9SDSywONPodeTDHqfsw_TIxzcgGE' 

export const supabase = createClient(supabaseUrl, supabaseKey)