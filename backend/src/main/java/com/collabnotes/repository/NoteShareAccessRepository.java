package com.collabnotes.repository;

import com.collabnotes.model.NoteShareAccess;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface NoteShareAccessRepository extends JpaRepository<NoteShareAccess, Long> {
    List<NoteShareAccess> findBySharedUserId(Long sharedUserId);
    List<NoteShareAccess> findByNoteId(Long noteId);
    Optional<NoteShareAccess> findByNoteIdAndSharedUserId(Long noteId, Long sharedUserId);
    void deleteByNoteIdAndSharedUserEmail(Long noteId, String sharedUserEmail);
}