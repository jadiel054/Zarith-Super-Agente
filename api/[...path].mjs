import supabase from '../lib/supabase.config';

export function logAgentAction() {
  supabase.from('agent_actions').insert([
    {
      action: ' teste ',
    },
  ]);
}