package com.collabnotes.controller;

import com.collabnotes.model.Note;
import com.collabnotes.model.NoteShareAccess;
import com.collabnotes.model.User;
import com.collabnotes.repository.NoteRepository;
import com.collabnotes.repository.NoteShareAccessRepository;
import com.collabnotes.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/notes")
public class NoteController {

    @Autowired
    private NoteRepository noteRepository;

    @Autowired
    private NoteShareAccessRepository noteShareAccessRepository;

    @Autowired
    private UserRepository userRepository;

    private User currentUser(Authentication authentication) {
        if (authentication == null || authentication.getName() == null) {
            return null;
        }
        return userRepository.findByEmail(authentication.getName()).orElse(null);
    }

    private boolean isOwner(Note note, User user) {
        return note != null && note.getOwner() != null && note.getOwner().getId() != null
            && user != null && user.getId() != null && note.getOwner().getId().equals(user.getId());
    }

    private Map<String, Object> notePayload(Note note, String accessType, Boolean editable) {
        Map<String, Object> payload = new HashMap<>();
        payload.put("id", note.getId());
        payload.put("title", note.getTitle());
        payload.put("content", note.getContent());
        payload.put("color", note.getColor());
        payload.put("pinned", note.isPinned());
        payload.put("archived", note.isArchived());
        payload.put("trashed", note.isTrashed());
        payload.put("shareCode", note.getShareCode());
        payload.put("shareEditable", note.isShareEditable());
        payload.put("accessType", accessType);
        if (editable != null) {
            payload.put("editable", editable);
        }
        if (note.getOwner() != null) {
            payload.put("ownerName", note.getOwner().getName());
            payload.put("ownerEmail", note.getOwner().getEmail());
        }
        return payload;
    }

    private Note updateNoteFields(Note note, Note payload) {
        if (payload.getTitle() != null) note.setTitle(payload.getTitle());
        if (payload.getContent() != null) note.setContent(payload.getContent());
        if (payload.getColor() != null) note.setColor(payload.getColor());
        note.setPinned(payload.isPinned());
        note.setArchived(payload.isArchived());
        note.setTrashed(payload.isTrashed());
        noteRepository.save(note);
        return note;
    }

    @PostMapping
    public ResponseEntity<?> createNote(@RequestBody Note note, Authentication authentication) {
        User owner = currentUser(authentication);
        if (owner == null) return ResponseEntity.badRequest().body(Map.of("error", "Owner not found"));
        if (note.getTitle() == null || note.getTitle().isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Title is required"));
        }
        note.setOwner(owner);
        note.setShareCode(null);
        note.setShareEditable(false);
        noteRepository.save(note);
        return ResponseEntity.ok(notePayload(note, "owner", true));
    }

    @GetMapping("/me")
    public List<Map<String, Object>> getMyNotes(Authentication authentication) {
        User owner = currentUser(authentication);
        if (owner == null) {
            return List.of();
        }
        return noteRepository.findByOwnerId(owner.getId()).stream().map(note -> notePayload(note, "owner", true)).toList();
    }

    @PostMapping("/{id}/share")
    public ResponseEntity<?> createShareLink(@PathVariable("id") Long id, @RequestBody(required = false) Map<String, Object> payload, Authentication authentication) {
        User owner = currentUser(authentication);
        if (owner == null) {
            return ResponseEntity.status(401).body(Map.of("error", "Unauthorized"));
        }

        boolean editable = payload != null && Boolean.TRUE.equals(payload.get("editable"));

        return noteRepository.findById(id).map(note -> {
            if (!isOwner(note, owner)) {
                return ResponseEntity.status(403).body(Map.of("error", "Forbidden"));
            }
            if (note.getShareCode() == null || note.getShareCode().isBlank()) {
                note.setShareCode(UUID.randomUUID().toString().replace("-", ""));
            }
            note.setShareEditable(editable);
            noteRepository.save(note);
            return ResponseEntity.ok(Map.of(
                "shareCode", note.getShareCode(),
                "shareEditable", note.isShareEditable(),
                "noteId", note.getId(),
                "revoked", false
            ));
        }).orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/{id}/share")
    public ResponseEntity<?> revokeShareLink(@PathVariable("id") Long id, Authentication authentication) {
        User owner = currentUser(authentication);
        if (owner == null) {
            return ResponseEntity.status(401).body(Map.of("error", "Unauthorized"));
        }

        return noteRepository.findById(id).map(note -> {
            if (!isOwner(note, owner)) {
                return ResponseEntity.status(403).body(Map.of("error", "Forbidden"));
            }
            note.setShareCode(null);
            note.setShareEditable(false);
            noteRepository.save(note);
            return ResponseEntity.ok(Map.of("revoked", true, "noteId", note.getId()));
        }).orElse(ResponseEntity.notFound().build());
    }

    @PostMapping("/{id}/share/user")
    public ResponseEntity<?> shareWithUser(@PathVariable("id") Long id, @RequestBody Map<String, Object> payload, Authentication authentication) {
        User owner = currentUser(authentication);
        if (owner == null) {
            return ResponseEntity.status(401).body(Map.of("error", "Unauthorized"));
        }

        String email = payload == null ? null : String.valueOf(payload.get("email")).trim();
        boolean editable = payload != null && Boolean.TRUE.equals(payload.get("editable"));
        if (email == null || email.isBlank() || "null".equalsIgnoreCase(email)) {
            return ResponseEntity.badRequest().body(Map.of("error", "Recipient email is required"));
        }

        return noteRepository.findById(id).map(note -> {
            if (!isOwner(note, owner)) {
                return ResponseEntity.status(403).body(Map.of("error", "Forbidden"));
            }

            User sharedUser = userRepository.findByEmail(email).orElse(null);
            if (sharedUser == null) {
                return ResponseEntity.status(404).body(Map.of("error", "User not found"));
            }

            NoteShareAccess access = noteShareAccessRepository.findByNoteIdAndSharedUserId(note.getId(), sharedUser.getId())
                .orElseGet(NoteShareAccess::new);
            access.setNote(note);
            access.setSharedUser(sharedUser);
            access.setEditable(editable);
            noteShareAccessRepository.save(access);

            Map<String, Object> result = new HashMap<>();
            result.put("noteId", note.getId());
            result.put("sharedUserEmail", sharedUser.getEmail());
            result.put("sharedUserName", sharedUser.getName());
            result.put("editable", access.isEditable());
            return ResponseEntity.ok(result);
        }).orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/{id}/share/user/{email}")
    public ResponseEntity<?> revokeSharedUser(@PathVariable("id") Long id, @PathVariable String email, Authentication authentication) {
        User owner = currentUser(authentication);
        if (owner == null) {
            return ResponseEntity.status(401).body(Map.of("error", "Unauthorized"));
        }

        return noteRepository.findById(id).map(note -> {
            if (!isOwner(note, owner)) {
                return ResponseEntity.status(403).body(Map.of("error", "Forbidden"));
            }
            noteShareAccessRepository.deleteByNoteIdAndSharedUserEmail(note.getId(), email);
            return ResponseEntity.ok(Map.of("revoked", true, "sharedUserEmail", email));
        }).orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/shared/me")
    public ResponseEntity<?> getSharedWithMe(Authentication authentication) {
        User current = currentUser(authentication);
        if (current == null) {
            return ResponseEntity.status(401).body(Map.of("error", "Unauthorized"));
        }

        List<Map<String, Object>> sharedNotes = new ArrayList<>();
        for (NoteShareAccess access : noteShareAccessRepository.findBySharedUserId(current.getId())) {
            Note note = access.getNote();
            if (note != null) {
                sharedNotes.add(notePayload(note, "direct", access.isEditable()));
            }
        }
        return ResponseEntity.ok(sharedNotes);
    }

    @GetMapping("/shared/{shareCode}")
    public ResponseEntity<?> getSharedNote(@PathVariable String shareCode, Authentication authentication) {
        User current = currentUser(authentication);
        if (current == null) {
            return ResponseEntity.status(401).body(Map.of("error", "Unauthorized"));
        }

        return noteRepository.findByShareCode(shareCode).map(note -> {
            if (note.getShareCode() == null || note.getShareCode().isBlank()) {
                return ResponseEntity.notFound().build();
            }
            return ResponseEntity.ok(notePayload(note, "code", note.isShareEditable()));
        }).orElse(ResponseEntity.notFound().build());
    }

    @PutMapping("/shared/{shareCode}")
    public ResponseEntity<?> updateSharedNote(@PathVariable String shareCode, @RequestBody Note payload, Authentication authentication) {
        User current = currentUser(authentication);
        if (current == null) {
            return ResponseEntity.status(401).body(Map.of("error", "Unauthorized"));
        }

        return noteRepository.findByShareCode(shareCode).map(note -> {
            if (!note.isShareEditable()) {
                return ResponseEntity.status(403).body(Map.of("error", "Shared note is read-only"));
            }
            return ResponseEntity.ok(notePayload(updateNoteFields(note, payload), "code", note.isShareEditable()));
        }).orElse(ResponseEntity.notFound().build());
    }

    @PutMapping("/shared/me/{id}")
    public ResponseEntity<?> updateDirectSharedNote(@PathVariable("id") Long id, @RequestBody Note payload, Authentication authentication) {
        User current = currentUser(authentication);
        if (current == null) {
            return ResponseEntity.status(401).body(Map.of("error", "Unauthorized"));
        }

        return noteShareAccessRepository.findByNoteIdAndSharedUserId(id, current.getId()).map(access -> {
            if (!access.isEditable()) {
                return ResponseEntity.status(403).body(Map.of("error", "Shared note is read-only"));
            }
            return noteRepository.findById(id)
                .map(note -> ResponseEntity.ok(notePayload(updateNoteFields(note, payload), "direct", access.isEditable())))
                .orElse(ResponseEntity.notFound().build());
        }).orElse(ResponseEntity.status(403).body(Map.of("error", "No access to this note")));
    }

    @PutMapping("/{id}")
    public ResponseEntity<?> updateNote(@PathVariable("id") Long id, @RequestBody Note payload, Authentication authentication) {
        User owner = currentUser(authentication);
        if (owner == null) {
            return ResponseEntity.status(401).body(Map.of("error", "Unauthorized"));
        }

        return noteRepository.findById(id).map(n -> {
            if (!isOwner(n, owner)) {
                return ResponseEntity.status(403).body(Map.of("error", "Forbidden"));
            }
            return ResponseEntity.ok(notePayload(updateNoteFields(n, payload), "owner", true));
        }).orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> deleteNote(@PathVariable("id") Long id, Authentication authentication) {
        User owner = currentUser(authentication);
        if (owner == null) {
            return ResponseEntity.status(401).body(Map.of("error", "Unauthorized"));
        }

        return noteRepository.findById(id).map(n -> {
            if (!isOwner(n, owner)) {
                return ResponseEntity.status(403).body(Map.of("error", "Forbidden"));
            }
            noteShareAccessRepository.findByNoteId(n.getId()).forEach(noteShareAccessRepository::delete);
            noteRepository.delete(n);
            return ResponseEntity.ok(Map.of("deleted", true));
        }).orElse(ResponseEntity.notFound().build());
    }
}
