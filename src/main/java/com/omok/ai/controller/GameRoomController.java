package com.omok.ai.controller;

import com.omok.ai.dto.GameStateDto;
import com.omok.ai.dto.RoomDto;
import com.omok.ai.entity.GameRoom;
import com.omok.ai.service.GameRoomService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/rooms")
@CrossOrigin(origins = "*")
public class GameRoomController {

    private final GameRoomService gameRoomService;

    public GameRoomController(GameRoomService gameRoomService) {
        this.gameRoomService = gameRoomService;
    }

    @PostMapping
    public ResponseEntity<RoomDto> createRoom(@RequestBody Map<String, Long> request) {
        Long hostId = request.get("hostId");
        GameRoom room = gameRoomService.createRoom(hostId);
        RoomDto dto = new RoomDto(
                room.getId(),
                room.getHost().getName(),
                room.getStatus().name(),
                room.getCreatedAt()
        );
        return ResponseEntity.ok(dto);
    }

    @GetMapping("/waiting")
    public ResponseEntity<List<RoomDto>> getWaitingRooms() {
        return ResponseEntity.ok(gameRoomService.getWaitingRooms());
    }

    @PostMapping("/{roomId}/join")
    public ResponseEntity<GameStateDto> joinRoom(
            @PathVariable Long roomId,
            @RequestBody Map<String, Long> request) {
        Long guestId = request.get("guestId");
        gameRoomService.joinRoom(roomId, guestId);
        GameStateDto state = gameRoomService.getGameState(roomId);
        return ResponseEntity.ok(state);
    }

    @GetMapping("/{roomId}/state")
    public ResponseEntity<GameStateDto> getGameState(@PathVariable Long roomId) {
        return ResponseEntity.ok(gameRoomService.getGameState(roomId));
    }

    @DeleteMapping("/{roomId}")
    public ResponseEntity<Void> deleteRoom(
            @PathVariable Long roomId,
            @RequestBody Map<String, Long> request) {
        Long hostId = request.get("hostId");
        gameRoomService.deleteRoomByHost(roomId, hostId);
        return ResponseEntity.noContent().build();
    }
}

