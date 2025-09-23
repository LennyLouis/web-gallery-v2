import { useState, useEffect } from 'react';
import { Container, Row, Col, Card, Button, Navbar, Nav, Badge, Modal, Spinner, Form } from 'react-bootstrap';
import { useParams, useSearchParams, useNavigate, Link } from 'react-router';
import { useAuth } from '~/contexts/AuthContext';
import { api, type Album, type Photo } from '~/lib/supabase';
import { apiClient } from '~/lib/apiClient';
import type { Route } from './+types/album.$id';

export function meta({}: Route.MetaArgs) {
  return [
    { title: 'Album - Les photos de Lenny' },
    { name: 'description', content: 'Découvrez et téléchargez vos photos' },
  ];
}

// Hook sécurisé pour useAuth qui ne crash pas si AuthProvider n'est pas disponible
const useSafeAuth = () => {
  try {
    return useAuth();
  } catch (error) {
    return {
      user: null,
      session: null,
      loading: false,
      isSessionValid: () => false
    };
  }
};

export default function AlbumPage() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  
  // Si il y a un token d'accès, on peut éviter d'utiliser le contexte d'auth pour l'instant
  const authData = useSafeAuth();
  const { user, session, loading: authLoading, isSessionValid } = authData;

  const [album, setAlbum] = useState<Album | null>(null);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [selectedPhotos, setSelectedPhotos] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string>('');
  const [showImageModal, setShowImageModal] = useState(false);
  const [selectedImage, setSelectedImage] = useState<Photo | null>(null);
  const [hasDownloadPermission, setHasDownloadPermission] = useState<boolean>(false);
  const [hasTriedPublicAccess, setHasTriedPublicAccess] = useState<boolean>(false);
  const [tokenCleared, setTokenCleared] = useState<number>(0); // Pour forcer re-évaluation
  const [isHandlingExpiredToken, setIsHandlingExpiredToken] = useState<boolean>(false);
  const [showLoginPrompt, setShowLoginPrompt] = useState<boolean>(false);

  // Pour les accès par lien - utiliser sessionStorage de manière sécurisée
  const urlToken = searchParams.get('token'); // Token venant de l'URL
  const storedAccessToken = typeof window !== 'undefined' ? sessionStorage.getItem('access_token') : null;
  const sessionAlbumId = typeof window !== 'undefined' ? sessionStorage.getItem('album_id') : null;
  
  // Utiliser le token de l'URL en priorité, sinon celui du sessionStorage
  const accessToken = urlToken || storedAccessToken;
  const isAccessLink = !!accessToken && (urlToken || sessionAlbumId === id);
  const isUserAccess = user && isSessionValid();

  // Fonction helper pour nettoyer les tokens expirés
  const clearExpiredToken = () => {
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('access_token');
      sessionStorage.removeItem('album_id');
    }
    setIsHandlingExpiredToken(true);
    setTokenCleared(prev => prev + 1); // Forcer re-évaluation
  };

  useEffect(() => {
    if (!id) return;

    // Attendre que l'authentification soit chargée avant de vérifier l'accès
    if (authLoading) return;

    // Si on est en train de gérer un token expiré, ne rien faire
    if (isHandlingExpiredToken) return;

    // Si il y a un token dans l'URL, le valider d'abord
    if (urlToken && !hasTriedPublicAccess) {
      validateAndSetAccessToken(urlToken);
      return;
    }

    // Si on a un accès valide (token d'accès ou utilisateur connecté), charger directement
    if (isAccessLink || isUserAccess) {
      loadAlbumData();
      return;
    }

    // Sinon, essayer de charger l'album en tant qu'album public (une seule fois)
    if (!hasTriedPublicAccess) {
      loadPublicAlbumData();
    }
  }, [id, user, urlToken, storedAccessToken, authLoading, isAccessLink, hasTriedPublicAccess, tokenCleared, isHandlingExpiredToken]);

  const loadAlbumData = async () => {
    if (!id) return;

    // Vérifier qu'on a un mode d'accès valide avant de continuer
    if (!isAccessLink && !isUserAccess) {
      return;
    }

    try {
      setLoading(true);

      if (isAccessLink && accessToken) {
        // Mode accès par lien : charger via token d'accès
        const albumResult = await api.getAlbum(id, accessToken);
        setAlbum(albumResult.album);

        const photosResult = await api.getPhotos(id, accessToken);
        setPhotos(photosResult.photos || []);
        
        // Pour les accès par lien, on suppose qu'ils ont les permissions de téléchargement
        setHasDownloadPermission(true);
      } else if (isUserAccess && session) {
        // Mode utilisateur connecté : charger via session utilisateur
        const [albumResult, photosResult] = await Promise.all([
          api.getAlbum(id),
          api.getPhotos(id)
        ]);

        setAlbum(albumResult.album);
        setPhotos(photosResult.photos || []);

        // Vérifier les permissions de téléchargement pour les utilisateurs connectés
        try {
          const permissionResult = await api.checkPermission(id, 'download');
          setHasDownloadPermission(permissionResult.has_permission);
        } catch (permErr) {
          // Si la vérification échoue, on assume pas de permission de téléchargement
          setHasDownloadPermission(false);
        }
      } else {
        // Aucun mode d'accès valide
        throw new Error('No valid access method available');
      }
    } catch (err: any) {
      console.error('Load album error:', err);
      
      // Si c'est une erreur 403 avec un token d'accès, le token a probablement expiré
      if (err.response?.status === 403 && isAccessLink) {
        clearExpiredToken();
        
        // Appeler directement loadPublicAlbumData au lieu de re-déclencher loadAlbumData
        try {
          await loadPublicAlbumData();
          return; // Sortir ici pour éviter de setter l'erreur
        } catch (publicErr) {
          console.error('Public access also failed:', publicErr);
          setError('Album non accessible');
        }
      } else {
        setError('Erreur lors du chargement de l\'album');
      }
    } finally {
      setLoading(false);
    }
  };

  const validateAndSetAccessToken = async (token: string) => {
    try {
      setLoading(true);
      setHasTriedPublicAccess(true); // Marquer qu'on a tenté l'accès

      // Valider le token d'accès
      const result = await api.validateAccessLink(token);

      if (result.success && result.album) {
        
        // Définir les permissions en fonction du type de lien d'accès
        if (result.accessLink && result.accessLink.permission_type) {
          const hasDownload = result.accessLink.permission_type === 'download';
          setHasDownloadPermission(hasDownload);
        } else {
          setHasDownloadPermission(false);
        }
        
        // Stocker le token validé dans sessionStorage
        if (typeof window !== 'undefined') {
          sessionStorage.setItem('access_token', token);
          sessionStorage.setItem('album_id', result.album.id);
        }

        // Vérifier que l'album correspond à celui demandé
        if (result.album.id === id) {
          // Recharger avec le token validé
          loadAlbumData();
        } else {
          navigate(`/album/${result.album.id}`);
        }
      } else {
        // Token invalide, nettoyer sessionStorage et essayer en tant qu'album public
        clearExpiredToken();
        loadPublicAlbumData();
      }
    } catch (err: any) {
      console.error('Token validation error:', err);
      
      // Si c'est une erreur 403 (token expiré), nettoyer sessionStorage
      if (err.response?.status === 403 || err.response?.status === 401) {
        clearExpiredToken();
      }
      
      // Si la validation échoue, essayer en tant qu'album public
      loadPublicAlbumData();
    }
  };

  const loadPublicAlbumData = async () => {
    if (!id) return;

    try {
      setLoading(true);
      setHasTriedPublicAccess(true); // Marquer qu'on a tenté l'accès public

      // Essayer de charger l'album en tant qu'album public
      // D'abord, récupérer tous les albums publics pour voir si celui-ci en fait partie
      const publicAlbumsResult = await apiClient.getPublicAlbums();
      const publicAlbum = publicAlbumsResult.albums.find((album: Album) => album.id === id);

      if (publicAlbum) {
        setAlbum(publicAlbum);

        // Charger les photos de l'album public (sans authentification)
        try {
          const photosResult = await apiClient.getPhotosByAccessToken(id, ''); // Essayer sans token
          setPhotos(photosResult.photos || []);
        } catch (photoErr) {
          setPhotos([]);
        }

        // Les albums publics ont les permissions de téléchargement
        setHasDownloadPermission(true);
      } else {
        // Album non public, afficher un message d'erreur au lieu de rediriger
        setError('Album privé - connexion requise');
        setShowLoginPrompt(true);
      }
    } catch (err) {
      console.error('Load public album error:', err);
      // Si ça échoue, afficher un message d'erreur
      setError('Erreur lors du chargement de l\'album');
      setShowLoginPrompt(true);
    } finally {
      setLoading(false);
    }
  };

  const togglePhotoSelection = (photoId: string) => {
    const newSelected = new Set(selectedPhotos);
    if (newSelected.has(photoId)) {
      newSelected.delete(photoId);
    } else {
      newSelected.add(photoId);
    }
    setSelectedPhotos(newSelected);
  };

  const selectAllPhotos = () => {
    if (selectedPhotos.size === photos.length) {
      setSelectedPhotos(new Set());
    } else {
      setSelectedPhotos(new Set(photos.map(p => p.id)));
    }
  };

  const handleDownloadSelected = async () => {
    if (selectedPhotos.size === 0) return;

    if (!hasDownloadPermission) {
      // Générer une liste des photos sélectionnées
      const selectedPhotosList = photos.filter(photo => selectedPhotos.has(photo.id));
      generatePhotoList(selectedPhotosList);
      return;
    }

    try {
      setDownloading(true);
      const photoIds = Array.from(selectedPhotos);

      if (isAccessLink && accessToken) {
        // Mode accès par lien : télécharger via token d'accès
        await api.downloadPhotos(photoIds, accessToken);
      } else if (isUserAccess) {
        // Mode utilisateur connecté : télécharger via session utilisateur
        await api.downloadPhotos(photoIds);
      } else {
        throw new Error('No valid access method for download');
      }

      // Le téléchargement est maintenant géré directement par l'API client
      // Pas besoin de traiter result.photos
      setSelectedPhotos(new Set());
    } catch (err) {
      console.error('Download error:', err);
      setError('Erreur lors du téléchargement');
    } finally {
      setDownloading(false);
    }
  };

  const handleDownloadAll = async () => {
    if (photos.length === 0) return;

    if (!hasDownloadPermission) {
      // Générer une liste des noms de photos
      generatePhotoList(photos);
      return;
    }

    try {
      setDownloading(true);
      const photoIds = photos.map(photo => photo.id);

      if (isAccessLink && accessToken) {
        // Mode accès par lien : télécharger via token d'accès
        await api.downloadPhotos(photoIds, accessToken);
      } else if (isUserAccess) {
        // Mode utilisateur connecté : télécharger via session utilisateur
        await api.downloadPhotos(photoIds);
      } else {
        throw new Error('No valid access method for download');
      }
    } catch (err) {
      console.error('Download all error:', err);
      setError('Erreur lors du téléchargement');
    } finally {
      setDownloading(false);
    }
  };

  const generatePhotoList = (photosToList: Photo[]) => {
    const photoNames = photosToList
      .map(photo => photo.filename || `Photo ${photo.id}`)
      .join('\n');
    
    const listContent = `Liste des photos - ${album?.title || 'Album'}\n` +
                       `Date: ${new Date().toLocaleDateString('fr-FR')}\n` +
                       `Nombre de photos: ${photosToList.length}\n\n` +
                       photoNames;

    // Créer un fichier texte téléchargeable
    const blob = new Blob([listContent], { type: 'text/plain;charset=utf-8' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `liste-photos-${album?.title?.replace(/[^a-zA-Z0-9]/g, '-') || 'album'}-${Date.now()}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  };

  const openImageModal = (photo: Photo) => {
    setSelectedImage(photo);
    setShowImageModal(true);
  };

  if (authLoading) {
    return (
      <div className="web-gallery">
        <Container className="py-5">
          <div className="text-center">
            <Spinner animation="border" className="mb-3" />
            <h5 className="text-muted">Chargement...</h5>
          </div>
        </Container>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="web-gallery">
        <Container className="py-5">
          <div className="text-center">
            <Spinner animation="border" style={{color: 'var(--bs-primary)'}} />
            <p className="mt-3 text-muted">Chargement de l'album...</p>
          </div>
        </Container>
      </div>
    );
  }

  if (error) {
    return (
      <div className="web-gallery">
        <Container className="py-5">
          <div className="text-center">
            <div className="fs-1 text-muted mb-3">⚠️</div>
            <h4 className="h5 text-muted mb-2">Erreur</h4>
            <p className="text-muted mb-4">{error}</p>
            {showLoginPrompt ? (
              <div className="d-flex gap-2 justify-content-center">
                <Button 
                  variant="primary" 
                  onClick={() => navigate('/login')}
                >
                  Se connecter
                </Button>
                <Button variant="outline-secondary" onClick={loadAlbumData}>
                  Réessayer
                </Button>
              </div>
            ) : (
              <Button variant="primary" onClick={loadAlbumData}>
                Réessayer
              </Button>
            )}
          </div>
        </Container>
      </div>
    );
  }

  if (!album) {
    return (
      <div className="web-gallery">
        <Container className="py-5">
          <div className="text-center">
            <div className="fs-1 text-muted mb-3">📁</div>
            <h4 className="h5 text-muted mb-2">Album introuvable</h4>
            <p className="text-muted mb-4">Cet album n'existe pas ou vous n'y avez pas accès.</p>
            <Link to={user ? '/dashboard' : '/login'}>
              <Button variant="primary">
                {user ? '← Retour au dashboard' : '← Connexion'}
              </Button>
            </Link>
          </div>
        </Container>
      </div>
    );
  }

  return (
    <div className="web-gallery">
      {/* Navigation */}
      {user && (
        <Navbar expand="lg" className="bg-white shadow-sm">
          <Container>
            <Navbar.Brand as={Link} to="/dashboard" className="fw-bold" style={{color: 'var(--bs-primary)'}}>
              📸 Les photos de Lenny
            </Navbar.Brand>
            <Nav className="ms-auto">
              <Nav.Link as={Link} to="/dashboard" style={{color: 'var(--bs-primary)'}}>
                ← Retour aux albums
              </Nav.Link>
            </Nav>
          </Container>
        </Navbar>
      )}

      {/* Album Header */}
      <div className="bg-light py-4">
        <Container>
          <Row>
            <Col>
              <div className="d-flex justify-content-between align-items-start">
                <div>
                  <h1 className="h2 fw-bold mb-2" style={{color: 'var(--bs-primary)'}}>
                    {album.title}
                  </h1>
                  {album.description && (
                    <p className="text-muted mb-3">{album.description}</p>
                  )}
                  <div className="d-flex flex-wrap gap-2 mb-3">
                    {album.date && (
                      <Badge bg="light" text="dark">
                        📅 {new Date(album.date).toLocaleDateString('fr-FR')}
                      </Badge>
                    )}
                    {album.location && (
                      <Badge bg="light" text="dark">
                        📍 {album.location}
                      </Badge>
                    )}
                    <Badge bg="primary" text="white">
                      📸 {photos.length} photo{photos.length > 1 ? 's' : ''}
                    </Badge>
                  </div>
                </div>

                {/* Selection Controls */}
                {photos.length > 0 && (
                  <div className="text-end">
                    <div className="mb-2">
                      <Button
                        variant="outline-primary"
                        size="sm"
                        onClick={selectAllPhotos}
                        className="me-2"
                      >
                        {selectedPhotos.size === photos.length ? 'Tout désélectionner' : 'Tout sélectionner'}
                      </Button>
                      <Button
                        variant={hasDownloadPermission ? "outline-success" : "outline-info"}
                        size="sm"
                        onClick={handleDownloadAll}
                        disabled={downloading}
                        className="me-2"
                      >
                        {downloading ? (
                          <>
                            <Spinner size="sm" className="me-1" />
                            {hasDownloadPermission ? 'Téléchargement...' : 'Génération...'}
                          </>
                        ) : (
                          hasDownloadPermission ? '⬇️ Tout télécharger' : '📋 Liste complète'
                        )}
                      </Button>
                      {selectedPhotos.size > 0 && (
                        <Badge bg="primary">
                          {selectedPhotos.size} sélectionnée{selectedPhotos.size > 1 ? 's' : ''}
                        </Badge>
                      )}
                    </div>
                    {selectedPhotos.size > 0 && (
                      <Button
                        variant={hasDownloadPermission ? "primary" : "outline-info"}
                        onClick={handleDownloadSelected}
                        disabled={downloading}
                      >
                        {downloading ? (
                          <>
                            <Spinner size="sm" className="me-2" />
                            {hasDownloadPermission ? 'Téléchargement...' : 'Génération...'}
                          </>
                        ) : (
                          hasDownloadPermission 
                            ? `⬇️ Télécharger (${selectedPhotos.size})`
                            : `📋 Liste (${selectedPhotos.size})`
                        )}
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </Col>
          </Row>
        </Container>
      </div>

      {/* Photos Grid */}
      <Container className="py-4">
        {photos.length === 0 ? (
          <div className="text-center py-5">
            <div className="fs-1 text-muted mb-3">📸</div>
            <h4 className="h5 text-muted mb-2">Aucune photo</h4>
            <p className="text-muted">Cet album ne contient pas encore de photos.</p>
          </div>
        ) : (
          <Row className="g-3">
            {photos.map((photo) => {
              const isSelected = selectedPhotos.has(photo.id);
              return (
                <Col key={photo.id} lg={2} md={3} sm={4} xs={6}>
                  <Card className={`card-clean photo-card-selectable ${isSelected ? 'selected' : ''}`}>
                    <div className="position-relative">
                      <Card.Img
                        variant="top"
                        src={photo.preview_url || photo.preview_path}
                        alt={photo.original_name}
                        style={{
                          height: '200px',
                          objectFit: 'cover',
                          cursor: 'pointer'
                        }}
                        onClick={() => openImageModal(photo)}
                      />

                      {/* Selection Checkbox */}
                      <div className="position-absolute top-0 end-0 p-2">
                        <Form.Check
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => togglePhotoSelection(photo.id)}
                          className="photo-checkbox"
                        />
                      </div>

                      {/* Selection Overlay */}
                      {isSelected && (
                        <div className="position-absolute top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center"
                             style={{
                               backgroundColor: 'rgba(111, 168, 220, 0.7)',
                               pointerEvents: 'none'
                             }}>
                          <div className="text-white fs-2">✓</div>
                        </div>
                      )}
                    </div>

                    <Card.Body className="p-2">
                      <small className="text-muted d-block text-truncate">
                        {photo.original_name}
                      </small>
                      <small className="text-muted">
                        {Math.round(photo.file_size / 1024)} KB
                      </small>
                    </Card.Body>
                  </Card>
                </Col>
              );
            })}
          </Row>
        )}
      </Container>

      {/* Image Modal */}
      <Modal show={showImageModal} onHide={() => setShowImageModal(false)} size="xl" centered>
        <Modal.Body className="p-0">
          {selectedImage && (
            <div className="text-center">
              <img
                src={selectedImage.download_url || selectedImage.file_path}
                alt={selectedImage.original_name}
                className="img-fluid"
                style={{ maxHeight: '80vh' }}
              />
              <div className="p-3 bg-light">
                <h5 className="mb-1">{selectedImage.original_name}</h5>
                <p className="text-muted mb-0">
                  {selectedImage.width}x{selectedImage.height} • {Math.round(selectedImage.file_size / 1024)} KB
                </p>
              </div>
            </div>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowImageModal(false)}>
            Fermer
          </Button>
          {selectedImage && (
            <Button
              className="btn-clean-primary"
              onClick={() => {
                if (selectedImage) {
                  togglePhotoSelection(selectedImage.id);
                  setShowImageModal(false);
                }
              }}
            >
              {selectedPhotos.has(selectedImage.id) ? 'Désélectionner' : 'Sélectionner'}
            </Button>
          )}
        </Modal.Footer>
      </Modal>
    </div>
  );
}