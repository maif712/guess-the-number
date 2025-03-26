import { supabase } from './supabase';

export async function getLeaderboard(limit = 10) {
  const { data, error } = await supabase
    .from('profiles')
    .select('username, score, email')
    .order('score', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data;
}