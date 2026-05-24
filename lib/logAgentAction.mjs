import supabase from './supabase.config';

export function logAgentAction(action) {
  supabase.from('agent_actions').insert([{ action }]);
}