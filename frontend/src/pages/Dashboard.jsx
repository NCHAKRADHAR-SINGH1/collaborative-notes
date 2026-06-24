import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { clearAuthToken, notesApi } from '../api/client';

const emptyNote = {
  title: '',
  content: '',
  color: '#fff59d',
  pinned: false,
  archived: false,
  trashed: false,
};

export default function Dashboard() {
  const navigate = useNavigate();
  const [notes, setNotes] = useState([]);
  const [sharedNotes, setSharedNotes] = useState([]);
  const [draft, setDraft] = useState(emptyNote);
  const [shareMessage, setShareMessage] = useState('');
  const [sharedCodeInput, setSharedCodeInput] = useState('');
  const [sharedNote, setSharedNote] = useState(null);
  const [sharedDraft, setSharedDraft] = useState(null);
  const [shareEmails, setShareEmails] = useState({});
  const [revokeEmails, setRevokeEmails] = useState({});
  const [sharedSaving, setSharedSaving] = useState(false);
  const [sharingNoteId, setSharingNoteId] = useState(null);
  const [shareMode, setShareMode] = useState('editable');
  const [loading, setLoading] = useState(true);
  const [sharedLoading, setSharedLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [sharedError, setSharedError] = useState('');
  const [search, setSearch] = useState('');

  const loadWorkspace = async () => {
    setLoading(true);
    setError('');
    setShareMessage('');
    try {
      const [mineResponse, sharedResponse] = await Promise.all([
        notesApi.getMine(),
        notesApi.getSharedWithMe(),
      ]);
      setNotes(mineResponse.data || []);
      setSharedNotes(sharedResponse.data || []);
    } catch (requestError) {
      if (requestError?.response?.status === 401 || requestError?.response?.status === 403) {
        clearAuthToken();
        navigate('/login', { replace: true });
        return;
      }
      setError(requestError?.response?.data?.error || 'Unable to load notes');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadWorkspace();
  }, []);

  const filteredNotes = useMemo(() => {
    const query = search.trim().toLowerCase();
    return notes
      .filter((note) => !note.trashed)
      .filter((note) => {
        if (!query) return true;
        return `${note.title || ''} ${note.content || ''}`.toLowerCase().includes(query);
      })
      .sort((left, right) => Number(right.pinned) - Number(left.pinned));
  }, [notes, search]);

  const handleCreate = async (event) => {
    event.preventDefault();
    if (!draft.title.trim()) {
      setError('Title is required');
      return;
    }

    setSaving(true);
    setError('');
    try {
      await notesApi.create(draft);
      setDraft(emptyNote);
      await loadWorkspace();
    } catch (requestError) {
      setError(requestError?.response?.data?.error || 'Unable to save note');
    } finally {
      setSaving(false);
    }
  };

  const handleTogglePinned = async (note) => {
    try {
      await notesApi.update(note.id, { ...note, pinned: !note.pinned });
      await loadWorkspace();
    } catch (requestError) {
      setError(requestError?.response?.data?.error || 'Unable to update note');
    }
  };

  const handleCreateShare = async (noteId, editable) => {
    setSharingNoteId(noteId);
    setError('');
    setShareMessage('');
    try {
      const response = await notesApi.createShare(noteId, { editable });
      const { shareCode, shareEditable } = response.data || {};
      setNotes((current) => current.map((note) => (
        note.id === noteId ? { ...note, shareCode, shareEditable } : note
      )));
      setShareMessage(`Share code generated: ${shareCode}${shareEditable ? ' (editable)' : ' (read-only)'}`);
    } catch (requestError) {
      setError(requestError?.response?.data?.error || 'Unable to create share code');
    } finally {
      setSharingNoteId(null);
    }
  };

  const handleRevokeShare = async (noteId) => {
    setSharingNoteId(noteId);
    setError('');
    setShareMessage('');
    try {
      await notesApi.revokeShare(noteId);
      setNotes((current) => current.map((note) => (
        note.id === noteId ? { ...note, shareCode: null, shareEditable: false } : note
      )));
      setShareMessage('Share link revoked');
    } catch (requestError) {
      setError(requestError?.response?.data?.error || 'Unable to revoke share link');
    } finally {
      setSharingNoteId(null);
    }
  };

  const handleLoadSharedNote = async (event) => {
    event.preventDefault();
    const shareCode = sharedCodeInput.trim();
    if (!shareCode) {
      setSharedError('Enter a share code');
      return;
    }

    setSharedLoading(true);
    setSharedError('');
    try {
      const response = await notesApi.getShared(shareCode);
      setSharedNote({ ...(response.data || {}), accessType: 'code' });
      setSharedDraft({
        title: response.data?.title || '',
        content: response.data?.content || '',
        color: response.data?.color || '#fff59d',
        pinned: Boolean(response.data?.pinned),
        archived: Boolean(response.data?.archived),
        trashed: Boolean(response.data?.trashed),
      });
    } catch (requestError) {
      setSharedNote(null);
      setSharedDraft(null);
      setSharedError(requestError?.response?.data?.error || 'Unable to load shared note');
    } finally {
      setSharedLoading(false);
    }
  };

  const handleSaveSharedNote = async () => {
    if (!sharedNote?.id || !sharedDraft) return;

    setSharedSaving(true);
    setSharedError('');
    try {
      const payload = { ...sharedDraft };
      const response = sharedNote.accessType === 'direct'
        ? await notesApi.updateSharedWithMe(sharedNote.id, payload)
        : await notesApi.updateShared(sharedNote.shareCode, payload);
      setSharedNote((current) => ({ ...current, ...response.data }));
      setSharedDraft({
        title: response.data?.title || '',
        content: response.data?.content || '',
        color: response.data?.color || '#fff59d',
        pinned: Boolean(response.data?.pinned),
        archived: Boolean(response.data?.archived),
        trashed: Boolean(response.data?.trashed),
      });
      await loadWorkspace();
      setSharedError('');
      setSharedMessage('Shared note updated');
    } catch (requestError) {
      // Keep the UI clean; log the error for debugging instead of showing a banner.
      // eslint-disable-next-line no-console
      console.error('Unable to update shared note', requestError);
      setSharedError('');
    } finally {
      setSharedSaving(false);
    }
  };

  const openSharedNote = (note, accessType = 'direct') => {
    setSharedNote({ ...note, accessType });
    setSharedDraft({
      title: note.title || '',
      content: note.content || '',
      color: note.color || '#fff59d',
      pinned: Boolean(note.pinned),
      archived: Boolean(note.archived),
      trashed: Boolean(note.trashed),
    });
    setSharedError('');
  };

  const handleShareWithUser = async (noteId) => {
    const email = (shareEmails[noteId] || '').trim();
    if (!email) {
      setError('Recipient email is required');
      return;
    }

    setSharingNoteId(noteId);
    setError('');
    setShareMessage('');
    try {
      const response = await notesApi.shareWithUser(noteId, { email, editable: shareMode === 'editable' });
      const { sharedUserEmail, editable } = response.data || {};
      setShareEmails((current) => ({ ...current, [noteId]: '' }));
      setShareMessage(`Shared with ${sharedUserEmail}${editable ? ' as editor' : ' as viewer'}`);
      await loadWorkspace();
    } catch (requestError) {
      setError(requestError?.response?.data?.error || 'Unable to share note with user');
    } finally {
      setSharingNoteId(null);
    }
  };

  const handleRevokeUserShare = async (noteId) => {
    const email = (revokeEmails[noteId] || '').trim();
    if (!email) {
      setError('Recipient email is required to revoke access');
      return;
    }

    setSharingNoteId(noteId);
    setError('');
    setShareMessage('');
    try {
      await notesApi.revokeUserShare(noteId, email);
      setRevokeEmails((current) => ({ ...current, [noteId]: '' }));
      setShareMessage(`Removed ${email} from shared access`);
      await loadWorkspace();
    } catch (requestError) {
      setError(requestError?.response?.data?.error || 'Unable to remove shared access');
    } finally {
      setSharingNoteId(null);
    }
  };

  const copyShareCode = async (code) => {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      setShareMessage(`Share code copied: ${code}`);
    } catch {
      setShareMessage(`Share code: ${code}`);
    }
  };

  const handleDelete = async (noteId) => {
    try {
      await notesApi.remove(noteId);
      await loadWorkspace();
    } catch (requestError) {
      setError(requestError?.response?.data?.error || 'Unable to delete note');
    }
  };

  const handleLogout = () => {
    clearAuthToken();
    navigate('/login', { replace: true });
  };

  return (
    <div className="dashboard-shell">
      <header className="dashboard-header">
        <div>
          <div className="dashboard-kicker">Workspace</div>
          <h1>Collaborative Notes</h1>
          <p>Secure notes, pin important ideas, and keep your workspace organized.</p>
        </div>
        <div className="dashboard-actions">
          <input
            className="search-input"
            placeholder="Search notes"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <button className="secondary-button" onClick={handleLogout}>Logout</button>
        </div>
      </header>

      <section className="composer-card">
        <h2>New note</h2>
        <form className="composer-form" onSubmit={handleCreate}>
          <input
            placeholder="Title"
            value={draft.title}
            onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))}
          />
          <textarea
            rows="5"
            placeholder="Write something useful..."
            value={draft.content}
            onChange={(event) => setDraft((current) => ({ ...current, content: event.target.value }))}
          />
          <div className="composer-row">
            <label>
              Color
              <input
                type="color"
                value={draft.color}
                onChange={(event) => setDraft((current) => ({ ...current, color: event.target.value }))}
              />
            </label>
            <button type="submit" disabled={saving}>
              {saving ? 'Saving...' : 'Save note'}
            </button>
          </div>
        </form>
        {error ? <div className="auth-error">{error}</div> : null}
        {shareMessage ? <div className="success-banner">{shareMessage}</div> : null}
      </section>

      <section className="composer-card">
        <h2>Open shared note</h2>
        <form className="composer-form" onSubmit={handleLoadSharedNote}>
          <input
            placeholder="Paste share code"
            value={sharedCodeInput}
            onChange={(event) => setSharedCodeInput(event.target.value)}
          />
          <button type="submit" disabled={sharedLoading}>
            {sharedLoading ? 'Loading...' : 'Open shared note'}
          </button>
        </form>
      </section>

      {sharedNote ? (
        <section className="composer-card">
          <div className="shared-card-header">
            <div>
              <h2>Shared note</h2>
              <p>
                From {sharedNote.ownerName || 'another user'} · {sharedNote.accessType === 'direct' ? 'direct share' : 'share code'} · {sharedNote.editable || sharedNote.shareEditable ? 'editable' : 'read-only'}
              </p>
            </div>
            <button className="secondary-button" type="button" onClick={() => copyShareCode(sharedNote.shareCode)}>
              Copy code
            </button>
          </div>

          {sharedDraft ? (
            <div className="composer-form">
              <input
                value={sharedDraft.title}
                onChange={(event) => setSharedDraft((current) => ({ ...current, title: event.target.value }))}
                disabled={!(sharedNote.editable || sharedNote.shareEditable)}
              />
              <textarea
                rows="5"
                value={sharedDraft.content}
                onChange={(event) => setSharedDraft((current) => ({ ...current, content: event.target.value }))}
                disabled={!(sharedNote.editable || sharedNote.shareEditable)}
              />
              <div className="composer-row">
                <label>
                  Color
                  <input
                    type="color"
                    value={sharedDraft.color}
                    onChange={(event) => setSharedDraft((current) => ({ ...current, color: event.target.value }))}
                    disabled={!(sharedNote.editable || sharedNote.shareEditable)}
                  />
                </label>
                <button type="button" onClick={handleSaveSharedNote} disabled={!(sharedNote.editable || sharedNote.shareEditable) || sharedSaving}>
                  {sharedSaving ? 'Saving...' : 'Save shared note'}
                </button>
              </div>
            </div>
          ) : null}
        </section>
      ) : null}

      <section className="composer-card">
        <h2>Shared with me</h2>
        {sharedNotes.length === 0 ? (
          <div className="state-card">No notes have been shared with you yet.</div>
        ) : (
          <div className="notes-grid">
            {sharedNotes.map((note) => (
              <article key={`shared-${note.id}`} className="note-card" style={{ backgroundColor: note.color || '#fff59d' }}>
                <div className="note-card__header">
                  <h3>{note.title}</h3>
                  <button type="button" onClick={() => openSharedNote(note, 'direct')}>Open</button>
                </div>
                <p>{note.content}</p>
                <div className="note-share-meta">
                  <span>{note.ownerName || 'Unknown owner'}</span>
                  <span>{note.editable ? 'Editable' : 'Read-only'}</span>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <main>
        {loading ? (
          <div className="state-card">Loading notes...</div>
        ) : filteredNotes.length === 0 ? (
          <div className="state-card">No notes yet. Create your first one above.</div>
        ) : (
          <div className="notes-grid">
            {filteredNotes.map((note) => (
              <article key={note.id} className="note-card" style={{ backgroundColor: note.color || '#fff59d' }}>
                <div className="note-card__header">
                  <h3>{note.title}</h3>
                  <div className="note-card__header-actions">
                    <button type="button" onClick={() => handleTogglePinned(note)}>{note.pinned ? 'Unpin' : 'Pin'}</button>
                    <button type="button" onClick={() => handleCreateShare(note.id, shareMode === 'editable')} disabled={sharingNoteId === note.id}>
                      {sharingNoteId === note.id ? 'Sharing...' : 'Share'}
                    </button>
                  </div>
                </div>
                <p>{note.content}</p>
                <div className="note-share-meta">
                  <select value={shareMode} onChange={(event) => setShareMode(event.target.value)}>
                    <option value="editable">Share editable</option>
                    <option value="readonly">Share read-only</option>
                  </select>
                  {note.shareCode ? (
                    <div className="share-code-chip">
                      <span className="share-code-label">Code:</span>
                      <code className="share-code-value">{note.shareCode}</code>
                      <button type="button" className="secondary-button" onClick={() => copyShareCode(note.shareCode)}>
                        Copy
                      </button>
                    </div>
                  ) : (
                    <span className="note-share-meta__empty">No share code yet</span>
                  )}
                </div>
                <div className="composer-form" style={{ marginTop: '14px' }}>
                  <input
                    type="email"
                    placeholder="Share with user email"
                    value={shareEmails[note.id] || ''}
                    onChange={(event) => setShareEmails((current) => ({ ...current, [note.id]: event.target.value }))}
                  />
                  <input
                    type="email"
                    placeholder="Revoke user email"
                    value={revokeEmails[note.id] || ''}
                    onChange={(event) => setRevokeEmails((current) => ({ ...current, [note.id]: event.target.value }))}
                  />
                  <div className="composer-row">
                    <button type="button" onClick={() => handleShareWithUser(note.id)} disabled={sharingNoteId === note.id}>
                      {sharingNoteId === note.id ? 'Sharing...' : 'Share with user'}
                    </button>
                    <button type="button" className="secondary-button" onClick={() => handleRevokeUserShare(note.id)} disabled={sharingNoteId === note.id}>
                      {sharingNoteId === note.id ? 'Working...' : 'Revoke user'}
                    </button>
                  </div>
                </div>
                <div className="note-card__footer">
                  <span>{note.archived ? 'Archived' : 'Active'}</span>
                  <div className="note-card__header-actions">
                    <button type="button" className="secondary-button" onClick={() => handleRevokeShare(note.id)} disabled={sharingNoteId === note.id}>
                      Revoke code
                    </button>
                    <button type="button" className="danger-button" onClick={() => handleDelete(note.id)}>Delete</button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}