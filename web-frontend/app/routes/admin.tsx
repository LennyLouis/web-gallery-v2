import { useState, useEffect } from 'react';
import { Container, Row, Col, Card, Button, Table, Badge, Navbar, Nav, Dropdown, Spinner, Form, Modal } from 'react-bootstrap';
import { Link, useNavigate } from 'react-router';
import { useAuth } from '~/contexts/AuthContext';
import { useAlbums } from '~/hooks/useAlbums';
import { api, type Album } from '~/lib/supabase';
import type { Route } from './+types/admin';

export function meta({}: Route.MetaArgs) {
  return [
    { title: 'Administration - Les photos de Lenny' },
    { name: 'description', content: 'Interface d\'administration des albums' },
  ];
}

export default function AdminPage() {
  const navigate = useNavigate();
  const { user, logout, loading: authLoading } = useAuth();
  const [error, setError] = useState<string>('');
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Utiliser notre hook optimisé pour les albums
  const { albums, loading: albumsLoading, error: albumsError, refetch } = useAlbums();

  const loading = albumsLoading;

  useEffect(() => {
    if (albumsError) {
      setError('Erreur lors du chargement des albums');
    }
  }, [albumsError]);

  // Form for new album
  const [albumForm, setAlbumForm] = useState({
    title: '',
    description: '',
    date: '',
    location: '',
    tags: '',
    is_public: false
  });

  // Redirection si pas admin
  useEffect(() => {
    if (!authLoading && (!user || user.role !== 'admin')) {
      navigate('/dashboard');
    }
  }, [user, authLoading, navigate]);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const handleAlbumClick = (albumId: string) => {
    navigate(`/admin/album/${albumId}`);
  };

  const handleCreateAlbum = async () => {
    try {
      const albumData = {
        title: albumForm.title,
        description: albumForm.description || undefined,
        date: albumForm.date || undefined,
        location: albumForm.location || undefined,
        tags: albumForm.tags ? albumForm.tags.split(',').map(tag => tag.trim()).filter(tag => tag) : undefined,
        is_public: albumForm.is_public
      };

      await api.createAlbum(albumData);
      await refetch(); // Utiliser refetch du hook au lieu de loadAlbums
      setShowCreateModal(false);
      setAlbumForm({ title: '', description: '', date: '', location: '', tags: '', is_public: false });
      alert('Album créé avec succès !');

    } catch (err) {
      console.error('Create album error:', err);
      alert('Erreur lors de la création de l\'album');
    }
  };

  // Affichage pendant chargement auth
  if (authLoading) {
    return (
      <div className="web-gallery">
        <Container className="py-5">
          <div className="text-center">
            <Spinner animation="border" style={{color: 'var(--bs-primary)'}} />
            <p className="mt-3 text-muted">Chargement...</p>
          </div>
        </Container>
      </div>
    );
  }

  // Redirection si pas admin
  if (!user || user.role !== 'admin') {
    return null;
  }

  return (
    <div className="web-gallery">
      {/* Navigation */}
      <Navbar expand="lg" className="bg-white shadow-sm">
        <Container>
          <Navbar.Brand as={Link} to="/dashboard" className="fw-bold d-flex align-items-center" style={{color: 'var(--bs-primary)'}}>
            <img src="/logo-transparent-256x256.png" alt="Logo" width="32" height="32" className="me-2" />
            Les photos de Lenny - Administration
          </Navbar.Brand>
          <Navbar.Toggle aria-controls="basic-navbar-nav" />
          <Navbar.Collapse id="basic-navbar-nav">
            <Nav className="me-auto">
              <Nav.Link as={Link} to="/dashboard" style={{color: 'var(--bs-primary)'}}>📸 Albums</Nav.Link>
            </Nav>
            <Nav>
              <Dropdown align="end">
                <Dropdown.Toggle variant="link" className="text-decoration-none d-flex align-items-center" style={{color: 'var(--bs-primary)'}}>
                  <div className="rounded-circle bg-primary text-white d-flex align-items-center justify-content-center me-2"
                       style={{width: '32px', height: '32px', fontSize: '14px'}}>
                    {user.name.charAt(0).toUpperCase()}
                  </div>
                  <span className="fw-medium">{user.name}</span>
                </Dropdown.Toggle>
                <Dropdown.Menu>
                  <Dropdown.Item as={Link} to="/dashboard">📸 Albums</Dropdown.Item>
                  <Dropdown.Divider />
                  <Dropdown.Item onClick={handleLogout}>Logout</Dropdown.Item>
                </Dropdown.Menu>
              </Dropdown>
            </Nav>
          </Navbar.Collapse>
        </Container>
      </Navbar>

      {/* Main Content */}
      <Container className="py-4">
        <Row className="mb-4">
          <Col>
            <div className="d-flex justify-content-between align-items-center">
              <div>
                <h1 className="h2 fw-bold mb-2" style={{color: 'var(--bs-primary)'}}>
                  Administration des Albums 📁
                </h1>
                <p className="text-muted mb-0">
                  Gérez tous vos albums photo depuis cette interface
                </p>
              </div>
              <div>
                <Button
                  className="btn-clean-primary"
                  onClick={() => setShowCreateModal(true)}
                >
                  ➕ Nouvel Album
                </Button>
              </div>
            </div>
          </Col>
        </Row>

        {/* Albums Table */}
        <Row>
          <Col>
            <Card className="card-clean">
              <Card.Header className="bg-white">
                <h5 className="mb-0 fw-bold" style={{color: 'var(--bs-primary)'}}>
                  Albums ({albums.length})
                </h5>
              </Card.Header>
              <Card.Body className="p-0">
                {loading ? (
                  <div className="text-center py-5">
                    <Spinner animation="border" style={{color: 'var(--bs-primary)'}} />
                    <p className="mt-3 text-muted">Chargement des albums...</p>
                  </div>
                ) : error ? (
                  <div className="text-center py-5">
                    <div className="fs-1 text-muted mb-3">⚠️</div>
                    <h4 className="h5 text-muted mb-2">Erreur</h4>
                    <p className="text-muted mb-4">{error}</p>
                    <Button variant="primary" onClick={refetch}>
                      Réessayer
                    </Button>
                  </div>
                ) : albums.length === 0 ? (
                  <div className="text-center py-5">
                    <div className="fs-1 text-muted mb-3">📁</div>
                    <h4 className="h5 text-muted mb-2">Aucun album</h4>
                    <p className="text-muted mb-4">Commencez par créer votre premier album.</p>
                    <Button
                      className="btn-clean-primary"
                      onClick={() => setShowCreateModal(true)}
                    >
                      📁 Créer un album
                    </Button>
                  </div>
                ) : (
                  <div className="table-responsive">
                    <Table hover className="mb-0">
                      <thead className="bg-light">
                        <tr>
                          <th className="border-0 fw-bold">Album</th>
                          <th className="border-0 fw-bold">Photos</th>
                          <th className="border-0 fw-bold">Visibilité</th>
                          <th className="border-0 fw-bold">Date</th>
                          <th className="border-0 fw-bold">Créé le</th>
                          <th className="border-0 fw-bold text-end">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {albums.map((album) => (
                          <tr key={album.id} style={{ cursor: 'pointer' }}>
                            <td className="py-3" onClick={() => handleAlbumClick(album.id)}>
                              <div className="d-flex align-items-center">
                                <div className="me-3">
                                  {album.cover_photo_url ? (
                                    <img
                                      src={album.cover_photo_url}
                                      alt={album.title}
                                      className="rounded"
                                      style={{
                                        width: '50px',
                                        height: '50px',
                                        objectFit: 'cover'
                                      }}
                                    />
                                  ) : (
                                    <div className="bg-light rounded d-flex align-items-center justify-content-center"
                                         style={{ width: '50px', height: '50px' }}>
                                      <span className="text-muted fs-5">📸</span>
                                    </div>
                                  )}
                                </div>
                                <div>
                                  <h6 className="mb-1 fw-bold">{album.title}</h6>
                                  {album.description && (
                                    <small className="text-muted">
                                      {album.description.length > 50
                                        ? album.description.substring(0, 50) + '...'
                                        : album.description
                                      }
                                    </small>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td className="py-3" onClick={() => handleAlbumClick(album.id)}>
                              <Badge bg="light" text="dark">
                                {album.photo_count || 0} photo{(album.photo_count || 0) > 1 ? 's' : ''}
                              </Badge>
                            </td>
                            <td className="py-3" onClick={() => handleAlbumClick(album.id)}>
                              {album.is_public ? (
                                <Badge bg="success">🌐 Public</Badge>
                              ) : (
                                <Badge bg="secondary">🔒 Privé</Badge>
                              )}
                            </td>
                            <td className="py-3" onClick={() => handleAlbumClick(album.id)}>
                              {album.date ? (
                                <span className="text-muted">
                                  {new Date(album.date).toLocaleDateString('fr-FR')}
                                </span>
                              ) : (
                                <span className="text-muted">—</span>
                              )}
                            </td>
                            <td className="py-3" onClick={() => handleAlbumClick(album.id)}>
                              <span className="text-muted">
                                {new Date(album.created_at).toLocaleDateString('fr-FR')}
                              </span>
                            </td>
                            <td className="py-3 text-end">
                              <Button
                                variant="outline-primary"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleAlbumClick(album.id);
                                }}
                              >
                                ⚙️ Gérer
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </Table>
                  </div>
                )}
              </Card.Body>
            </Card>
          </Col>
        </Row>
      </Container>

      {/* Create Album Modal */}
      <Modal show={showCreateModal} onHide={() => setShowCreateModal(false)} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>Créer un nouvel album</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form>
            <Row>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label className="form-label-clean">Titre de l'album *</Form.Label>
                  <Form.Control
                    type="text"
                    className="form-control-clean"
                    value={albumForm.title}
                    onChange={(e) => setAlbumForm({...albumForm, title: e.target.value})}
                    placeholder="Entrez le titre de l'album"
                    required
                  />
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label className="form-label-clean">Date de l'évènement</Form.Label>
                  <Form.Control
                    type="date"
                    className="form-control-clean"
                    value={albumForm.date}
                    onChange={(e) => setAlbumForm({...albumForm, date: e.target.value})}
                  />
                </Form.Group>
              </Col>
            </Row>

            <Form.Group className="mb-3">
              <Form.Label className="form-label-clean">Description</Form.Label>
              <Form.Control
                as="textarea"
                rows={3}
                className="form-control-clean"
                value={albumForm.description}
                onChange={(e) => setAlbumForm({...albumForm, description: e.target.value})}
                placeholder="Description de l'album..."
              />
            </Form.Group>

            <Row>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label className="form-label-clean">Lieu</Form.Label>
                  <Form.Control
                    type="text"
                    className="form-control-clean"
                    value={albumForm.location}
                    onChange={(e) => setAlbumForm({...albumForm, location: e.target.value})}
                    placeholder="Lieu de l'évènement"
                  />
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label className="form-label-clean">Tags</Form.Label>
                  <Form.Control
                    type="text"
                    className="form-control-clean"
                    value={albumForm.tags}
                    onChange={(e) => setAlbumForm({...albumForm, tags: e.target.value})}
                    placeholder="mariage, famille, extérieur..."
                  />
                  <Form.Text className="text-muted">
                    Séparez les tags par des virgules
                  </Form.Text>
                </Form.Group>
              </Col>
            </Row>

            <Form.Group className="mb-3">
              <Form.Check
                type="checkbox"
                label="🌐 Album public (visible sur le site)"
                checked={albumForm.is_public}
                onChange={(e) => setAlbumForm({...albumForm, is_public: e.target.checked})}
              />
            </Form.Group>
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowCreateModal(false)}>
            Annuler
          </Button>
          <Button
            className="btn-clean-primary"
            onClick={handleCreateAlbum}
            disabled={!albumForm.title.trim()}
          >
            Créer l'album
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}