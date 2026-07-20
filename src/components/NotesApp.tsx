import { useEffect, useState, useCallback } from 'react';
import { Loader2, LogOut, NotebookPen, Pencil, Plus, Search, Trash2, X } from 'lucide-react';
import { supabase, type Note } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

type EditingState = { id: string } | 'new' | null;

export default function NotesApp() {
  const { user, signOut } = useAuth();
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<EditingState>(null);
  const [draftTitle, setDraftTitle] = useState('');
  const [draftContent, setDraftContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const loadNotes = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('notes')
      .select('*')
      .order('updated_at', { ascending: false });
    if (error) {
      setFormError(error.message);
    } else {
      setNotes(data ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadNotes();
  }, [loadNotes]);

  const openNew = () => {
    setEditing('new');
    setDraftTitle('');
    setDraftContent('');
    setFormError(null);
  };

  const openEdit = (note: Note) => {
    setEditing({ id: note.id });
    setDraftTitle(note.title);
    setDraftContent(note.content);
    setFormError(null);
  };

  const closeEditor = () => {
    setEditing(null);
    setDraftTitle('');
    setDraftContent('');
    setFormError(null);
  };

  const save = async () => {
    if (!draftTitle.trim()) {
      setFormError('Title is required.');
      return;
    }
    setSaving(true);
    setFormError(null);

    if (editing === 'new') {
      const { data, error } = await supabase
        .from('notes')
        .insert({ title: draftTitle.trim(), content: draftContent.trim() })
        .select()
        .single();
      if (error) {
        setFormError(error.message);
        setSaving(false);
        return;
      }
      setNotes((prev) => [data, ...prev]);
    } else if (editing && typeof editing === 'object') {
      const { data, error } = await supabase
        .from('notes')
        .update({ title: draftTitle.trim(), content: draftContent.trim() })
        .eq('id', editing.id)
        .select()
        .single();
      if (error) {
        setFormError(error.message);
        setSaving(false);
        return;
      }
      setNotes((prev) =>
        [data, ...prev.filter((n) => n.id !== data.id)].sort(
          (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
        )
      );
    }
    setSaving(false);
    closeEditor();
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from('notes').delete().eq('id', id);
    if (error) {
      setFormError(error.message);
      return;
    }
    setNotes((prev) => prev.filter((n) => n.id !== id));
  };

  const filtered = notes.filter(
    (n) =>
      n.title.toLowerCase().includes(search.toLowerCase()) ||
      n.content.toLowerCase().includes(search.toLowerCase())
  );

  const isEditorOpen = editing !== null;

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-slate-900 flex items-center justify-center">
              <NotebookPen className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-base font-semibold text-slate-900 leading-none">Lumen Notes</h1>
              <p className="text-xs text-slate-500 mt-0.5">{user?.email}</p>
            </div>
          </div>
          <button
            onClick={signOut}
            className="flex items-center gap-1.5 text-sm text-slate-600 hover:text-slate-900 px-3 py-2 rounded-lg hover:bg-slate-100 transition"
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:inline">Sign out</span>
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Your notes</h2>
            <p className="text-sm text-slate-500 mt-0.5">
              {notes.length} {notes.length === 1 ? 'note' : 'notes'}
            </p>
          </div>
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search notes..."
                className="w-full pl-10 pr-3 py-2 rounded-lg border border-slate-300 bg-white text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400 transition"
              />
            </div>
            <button
              onClick={openNew}
              className="flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-white text-sm font-medium px-4 py-2 rounded-lg transition whitespace-nowrap"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">New note</span>
            </button>
          </div>
        </div>

        {formError && !isEditorOpen && (
          <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            {formError}
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-6 h-6 text-slate-400 animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
              <NotebookPen className="w-7 h-7 text-slate-400" />
            </div>
            <p className="text-slate-900 font-medium">
              {search ? 'No notes match your search.' : 'No notes yet.'}
            </p>
            <p className="text-sm text-slate-500 mt-1">
              {search ? 'Try a different term.' : 'Create your first note to get started.'}
            </p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((note) => (
              <article
                key={note.id}
                className="group bg-white rounded-xl border border-slate-200 p-5 hover:shadow-lg hover:shadow-slate-900/5 hover:border-slate-300 transition flex flex-col"
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <h3 className="font-semibold text-slate-900 leading-snug line-clamp-2">
                    {note.title}
                  </h3>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition shrink-0">
                    <button
                      onClick={() => openEdit(note)}
                      className="p-1.5 rounded-md text-slate-400 hover:text-slate-900 hover:bg-slate-100 transition"
                      aria-label="Edit note"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => remove(note.id)}
                      className="p-1.5 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 transition"
                      aria-label="Delete note"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                <p className="text-sm text-slate-600 line-clamp-4 whitespace-pre-wrap flex-1">
                  {note.content || 'No content'}
                </p>
                <p className="text-xs text-slate-400 mt-3 pt-3 border-t border-slate-100">
                  {new Date(note.updated_at).toLocaleDateString(undefined, {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </p>
              </article>
            ))}
          </div>
        )}
      </main>

      {isEditorOpen && (
        <div className="fixed inset-0 z-20 flex items-end sm:items-center justify-center bg-slate-900/40 backdrop-blur-sm px-0 sm:px-4">
          <div className="bg-white w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl shadow-2xl flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <h2 className="font-semibold text-slate-900">
                {editing === 'new' ? 'New note' : 'Edit note'}
              </h2>
              <button
                onClick={closeEditor}
                className="p-1.5 rounded-md text-slate-400 hover:text-slate-900 hover:bg-slate-100 transition"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="px-6 py-5 space-y-4 overflow-y-auto">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Title</label>
                <input
                  value={draftTitle}
                  onChange={(e) => setDraftTitle(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg border border-slate-300 bg-white text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400 transition"
                  placeholder="Note title"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Content</label>
                <textarea
                  value={draftContent}
                  onChange={(e) => setDraftContent(e.target.value)}
                  rows={8}
                  className="w-full px-3 py-2.5 rounded-lg border border-slate-300 bg-white text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400 transition resize-none"
                  placeholder="Write your note..."
                />
              </div>
              {formError && (
                <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
                  {formError}
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-200">
              <button
                onClick={closeEditor}
                className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 rounded-lg hover:bg-slate-100 transition"
              >
                Cancel
              </button>
              <button
                onClick={save}
                disabled={saving}
                className="flex items-center gap-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-60 text-white text-sm font-medium px-4 py-2 rounded-lg transition"
              >
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                {editing === 'new' ? 'Create note' : 'Save changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
