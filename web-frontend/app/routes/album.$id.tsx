import { useState, useEffect } from 'react';
import { Container, Row, Col, Card, Button, Navbar, Nav, Badge, Modal, Spinner, Form } from 'react-bootstrap';
import { useParams, useSearchParams, useNavigate, Link } from 'react-router';
import { useAuth } from '~/contexts/AuthContext';
import { api, type Album, type Photo } from '~/lib/supabase';
import type { Route } from './+types/album.$id';

export function meta({}: Route.MetaArgs) {
  return [
    { title: 'Album - Les photos de Lenny' },
    { name: 'description', content: 'Découvrez et téléchargez vos photos' },
  ];
}

export default function AlbumPage() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, session } = useAuth();

  const [album, setAlbum] = useState<Album | null>(null);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [selectedPhotos, setSelectedPhotos] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string>('');
  const [showImageModal, setShowImageModal] = useState(false);
  const [selectedImage, setSelectedImage] = useState<Photo | null>(null);

  // Pour les accès par lien - utiliser sessionStorage de manière sécurisée
  const accessToken = sessionStorage.getItem('access_token');
  const sessionAlbumId = sessionStorage.getItem('album_id');
  const isAccessLink = !!accessToken && !user && sessionAlbumId === id;

  useEffect(() => {
    if (!id) return;

    // Si pas de token d'accès et pas d'utilisateur connecté, rediriger
    if (!isAccessLink && !user) {
      navigate('/login');
      return;
    }

    loadAlbumData();
  }, [id, user, accessToken]);

  const loadAlbumData = async () => {
    if (!id) return;

    try {
      setLoading(true);

      if (isAccessLink && accessToken) {
        // Charger album via lien d'accès sécurisé
        const albumResult = await api.getAlbum(id, accessToken);
        setAlbum(albumResult.album);

        // Charger photos via lien d'accès
        const photosResult = await api.getPhotos(id, accessToken);
        setPhotos(photosResult.photos || []);
      } else if (session) {
        // Charger album normalement
        const [albumResult, photosResult] = await Promise.all([
          api.getAlbum(id),
          api.getPhotos(id)
        ]);

        setAlbum(albumResult.album);
        setPhotos(photosResult.photos || []);
      }
    } catch (err) {
      setError('Erreur lors du chargement de l\'album');
      console.error('Load album error:', err);
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

    try {
      setDownloading(true);
      const photoIds = Array.from(selectedPhotos);

      if (isAccessLink && accessToken) {
        // Download via access link sécurisé
        const result = await api.downloadPhotos(photoIds, accessToken);

        if (result.photos) {
          // Créer et télécharger les fichiers
          result.photos.forEach((photo: any, index: number) => {
            setTimeout(() => {
              const a = document.createElement('a');
              a.href = photo.download_url;
              a.download = photo.filename;
              a.click();
            }, index * 100); // Délai pour éviter de bloquer le navigateur
          });
        }
      } else if (session) {
        const result = await api.downloadPhotos(photoIds);

        if (result.photos) {
          // Créer et télécharger les fichiers
          result.photos.forEach((photo: any, index: number) => {
            setTimeout(() => {
              const a = document.createElement('a');
              a.href = photo.download_url;
              a.download = photo.filename;
              a.click();
            }, index * 100); // Délai pour éviter de bloquer le navigateur
          });
        }
      }

      setSelectedPhotos(new Set());
    } catch (err) {
      console.error('Download error:', err);
      setError('Erreur lors du téléchargement');
    } finally {
      setDownloading(false);
    }
  };

  const openImageModal = (photo: Photo) => {
    setSelectedImage(photo);
    setShowImageModal(true);
  };

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
            <Button variant="primary" onClick={loadAlbumData}>
              Réessayer
            </Button>
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
                      {selectedPhotos.size > 0 && (
                        <Badge bg="primary">
                          {selectedPhotos.size} sélectionnée{selectedPhotos.size > 1 ? 's' : ''}
                        </Badge>
                      )}
                    </div>
                    {selectedPhotos.size > 0 && (
                      <Button
                        className="btn-clean-primary"
                        onClick={handleDownloadSelected}
                        disabled={downloading}
                      >
                        {downloading ? (
                          <>
                            <Spinner size="sm" className="me-2" />
                            Téléchargement...
                          </>
                        ) : (
                          `⬇️ Télécharger (${selectedPhotos.size})`
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
                        src={photo.preview_path} // TODO: Gérer les URLs signées
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
                src={selectedImage.file_path} // TODO: Gérer les URLs signées
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