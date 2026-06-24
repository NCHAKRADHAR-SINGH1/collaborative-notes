package com.collabnotes.repository;

import com.collabnotes.model.Note;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;
import java.util.List;

public interface NoteRepository extends JpaRepository<Note, Long> {
    List<Note> findByOwnerId(Long ownerId);
    Optional<Note> findByShareCode(String shareCode);
}
