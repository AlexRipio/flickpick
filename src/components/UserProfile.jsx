import React, { useState } from 'react';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { LogOut, Edit3 } from 'lucide-react';
import { useProfile } from '@/contexts/ProfileContext';

const UserProfile = () => {
  const { profile, setName, clearProfile } = useProfile();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(profile?.name || '');

  if (!profile?.name) return null;
  const initial = (profile.name || 'U').charAt(0).toUpperCase();

  const save = () => { if (draft.trim()) { setName(draft.trim()); setEditing(false); } };

  return (
    <div className="absolute top-4 right-4 z-50 flex items-center gap-2">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="relative h-10 w-10 rounded-full">
            <Avatar className="h-10 w-10">
              <AvatarFallback className="bg-purple-800 text-white font-bold">{initial}</AvatarFallback>
            </Avatar>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-56 bg-slate-900 border-slate-700 text-white" align="end">
          <DropdownMenuLabel>
            <div className="flex flex-col">
              <p className="text-sm font-medium">Perfil</p>
              {editing ? (
                <div className="flex gap-1 mt-1">
                  <input value={draft} onChange={e => setDraft(e.target.value)} className="bg-slate-800 text-white text-sm px-2 py-1 rounded w-32 outline-none" />
                  <button onClick={save} className="text-xs bg-purple-700 px-2 rounded">OK</button>
                </div>
              ) : (
                <p className="text-xs text-slate-400 truncate">{profile.name}</p>
              )}
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator className="bg-slate-700" />
          <DropdownMenuItem className="cursor-pointer hover:bg-slate-800" onClick={() => { setDraft(profile.name); setEditing(true); }}>
            <Edit3 className="mr-2 h-4 w-4" /><span>Cambiar nombre</span>
          </DropdownMenuItem>
          <DropdownMenuItem className="cursor-pointer hover:bg-slate-800" onClick={clearProfile}>
            <LogOut className="mr-2 h-4 w-4" /><span>Salir del perfil</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
};

export default UserProfile;
