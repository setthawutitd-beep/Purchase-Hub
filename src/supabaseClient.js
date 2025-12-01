import { createClient } from '@supabase/supabase-js'

// เปลี่ยนให้มันรอรับค่าจากตัวแปรระบบแทน (ทั้งบนเครื่องเรา และบน Vercel)
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_KEY

export const supabase = createClient(supabaseUrl, supabaseKey)