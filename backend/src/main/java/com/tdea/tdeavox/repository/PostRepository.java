package com.tdea.tdeavox.repository;

import com.tdea.tdeavox.model.Post;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface PostRepository extends JpaRepository<Post, Integer> {
    List<Post> findAllByOrderByFechaCreacionDesc();
    List<Post> findByCategoriaIdOrderByFechaCreacionDesc(Integer categoriaId);
    List<Post> findByTituloContainingIgnoreCaseOrderByFechaCreacionDesc(String keyword);
    List<Post> findByUsuarioIdOrderByFechaCreacionDesc(Integer usuarioId);
}
