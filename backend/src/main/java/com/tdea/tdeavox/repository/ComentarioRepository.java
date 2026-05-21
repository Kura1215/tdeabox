package com.tdea.tdeavox.repository;

import com.tdea.tdeavox.model.Comentario;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface ComentarioRepository extends JpaRepository<Comentario, Integer> {
    List<Comentario> findByPostIdOrderByFechaCreacionAsc(Integer postId);
}
