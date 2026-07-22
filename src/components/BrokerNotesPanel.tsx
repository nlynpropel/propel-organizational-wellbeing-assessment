import { useState, useEffect, useCallback } from 'react';
import { StickyNote, Plus, Pencil, Trash2, Check, X, Loader2, AlertCircle } from 'lucide-react';
import Button from './ui/Button';
import ConfirmationModal from './ui/ConfirmationModal';
import LoadingState from './ui/LoadingState';
import { useAuth } from '../context/AuthContext';
import {
  fetchNotesForOrganization,
  createNote,
  updateNote,
  deleteNote,
} from '../services/brokerNotes';
import type { BrokerNoteRow } from '../lib/database.types';

export default function BrokerNotesPanel({ organizationId }: { organizationId: string }) {
  const { profile } = useAuth();
  const [notes, setNotes] = useState<BrokerNoteRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newNoteText, setNewNoteText] = useState('');
  const [savingNew, setSavingNew] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<BrokerNoteRow | null>(null);

  const load = useCallback(async () => {
    if (!profile) return;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchNotesForOrganization(profile.id, organizationId);
      setNotes(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load notes.');
    } finally {
      setLoading(false);
    }
  }, [profile, organizationId]);

  useEffect(() => {
    load();
  }, [load]);

  const handleCreate = async () => {
    if (!profile || !newNoteText.trim()) return;
    setSavingNew(true);
    setError(null);
    try {
      const note = await createNote(profile.id, organizationId, newNoteText.trim());
      setNotes((prev) => [note, ...prev]);
      setNewNoteText('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create note.');
    } finally {
      setSavingNew(false);
    }
  };

  const startEdit = (note: BrokerNoteRow) => {
    setEditingId(note.id);
    setEditingText(note.note_text);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditingText('');
  };

  const handleSaveEdit = async () => {
    if (!profile || !editingId || !editingText.trim()) return;
    setSavingEdit(true);
    setError(null);
    try {
      const updated = await updateNote(profile.id, editingId, editingText.trim());
      setNotes((prev) => prev.map((n) => (n.id === editingId ? updated : n)));
      cancelEdit();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update note.');
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDelete = async () => {
    if (!profile || !deleteTarget) return;
    setError(null);
    try {
      await deleteNote(profile.id, deleteTarget.id);
      setNotes((prev) => prev.filter((n) => n.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete note.');
      setDeleteTarget(null);
    }
  };

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <StickyNote className="w-4 h-4 text-navy" />
        <span className="text-sm font-semibold text-navy">Analysis Notes</span>
        <span className="text-xs text-neutral-muted ml-1">({notes.length})</span>
      </div>

      {error && (
        <div className="mb-4 rounded-md border border-red/20 bg-red-tint px-3 py-2 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-red shrink-0 mt-0.5" />
          <p className="text-sm text-red">{error}</p>
        </div>
      )}

      {/* New note input */}
      <div className="mb-4">
        <textarea
          value={newNoteText}
          onChange={(e) => setNewNoteText(e.target.value)}
          rows={3}
          placeholder="Add a note about this client — renewal timing, key contacts, strategy notes…"
          className="w-full px-3 py-2.5 rounded-md border border-neutral-border bg-white text-sm text-navy placeholder-neutral-muted focus:outline-none focus:border-green focus:ring-2 focus:ring-green/20 transition resize-none"
        />
        <div className="flex justify-end mt-2">
          <Button
            size="sm"
            onClick={handleCreate}
            disabled={!newNoteText.trim() || savingNew}
          >
            {savingNew ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
            {savingNew ? 'Saving…' : 'Add note'}
          </Button>
        </div>
      </div>

      {/* Notes list */}
      {loading ? (
        <LoadingState label="Loading notes…" />
      ) : notes.length === 0 ? (
        <div className="py-8 text-center text-sm text-neutral-muted">
          No notes yet. Add context about this client above.
        </div>
      ) : (
        <div className="space-y-3">
          {notes.map((note) => (
            <div
              key={note.id}
              className="rounded-md border border-neutral-border bg-neutral-bg/50 p-3 group"
            >
              {editingId === note.id ? (
                <div>
                  <textarea
                    value={editingText}
                    onChange={(e) => setEditingText(e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 rounded-sm border border-neutral-border bg-white text-sm text-navy focus:outline-none focus:border-green focus:ring-2 focus:ring-green/20 transition resize-none"
                    autoFocus
                  />
                  <div className="flex justify-end gap-2 mt-2">
                    <Button variant="ghost" size="sm" onClick={cancelEdit}>
                      <X className="w-3.5 h-3.5" /> Cancel
                    </Button>
                    <Button size="sm" onClick={handleSaveEdit} disabled={!editingText.trim() || savingEdit}>
                      {savingEdit ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                      Save
                    </Button>
                  </div>
                </div>
              ) : (
                <div>
                  <p className="text-sm text-navy whitespace-pre-wrap">{note.note_text}</p>
                  <div className="flex items-center justify-between mt-2 pt-2 border-t border-neutral-border-soft">
                    <span className="text-xs text-neutral-muted">
                      {new Date(note.created_at).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </span>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                      <button
                        onClick={() => startEdit(note)}
                        className="p-1 rounded-sm text-neutral-muted hover:text-navy hover:bg-navy/5 transition"
                        aria-label="Edit note"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setDeleteTarget(note)}
                        className="p-1 rounded-sm text-neutral-muted hover:text-red hover:bg-red-tint transition"
                        aria-label="Delete note"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <ConfirmationModal
        open={!!deleteTarget}
        title="Delete this note?"
        message="This note will be permanently deleted. This action cannot be undone."
        confirmLabel="Delete note"
        onCancel={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
      />
    </div>
  );
}
