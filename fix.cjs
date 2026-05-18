const fs = require('fs');
let code = fs.readFileSync('src/lib/dashboardData.ts', 'utf-8');

// Fix syntax error
code = code.replace(/export async function updateProfileDetails[\s\S]*?\} = await supabase[\s\S]*?\n\}/, 
`export async function updateProfileDetails(
  id: string,
  updates: { full_name?: string; username?: string; }
) {
  const { data, error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', id)
    .select();

  throwIfError(error);
}`);

// Fix interface Profile
code = code.replace(/export interface Profile \{[\s\S]*?\}/,
`export interface Profile {
  id: string;
  email: string | null;
  full_name: string | null;
  role: UserRole;
  username?: string | null;
  created_at: string;
}`);

fs.writeFileSync('src/lib/dashboardData.ts', code);
